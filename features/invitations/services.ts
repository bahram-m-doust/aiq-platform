import "server-only";

import { failure } from "@/features/access/access-key-rules";
import { isCurrentActiveEntitlementWindow } from "@/features/access/entitlement-window";
import { activateRedeemedBrandMembership } from "@/features/access/redeemed-brand-membership";
import type { AccessKeySafeRecord } from "@/features/access/types";
import {
  createAccessKey,
  updateAccessKeyEmailDelivery,
} from "@/features/access/services";
import {
  buildInvitationAcceptUrl,
  toMemberInvitedAudit,
  toMemberJoinedAudit,
  validateJoinBrandAccessKey,
} from "@/features/invitations/schema";
import { getSpecialistInvitationContext } from "@/features/invitations/queries";
import type {
  SpecialistInvitationInput,
  SpecialistInvitationResult,
  SpecialistMembershipRecord,
} from "@/features/invitations/types";
import { sendEmailWithResend, getResendEmailConfig } from "@/lib/email/sendEmail";
import { buildSpecialistInvitationEmail } from "@/lib/email/templates";
import { logAudit } from "@/lib/audit/logAudit";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

type BrandRow = {
  id: string;
  name: string;
  status: string;
};

type EntitlementRow = {
  id: string;
  brand_id: string;
  status: string;
  starts_at: string | null;
  expires_at: string | null;
};

type MembershipRow = {
  id: string;
  brand_id: string;
  user_id: string;
  role: string;
  status: string;
  invited_by: string | null;
};

const CODE = "invitation";

function invitationError(message: string): never {
  throw new DomainError(CODE, message);
}

export function isInvitationError(error: unknown): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}

function isActiveEntitlement(row: EntitlementRow, now = new Date()) {
  return isCurrentActiveEntitlementWindow({
    status: row.status,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    now,
  });
}

function toSpecialistMembershipRecord(
  row: MembershipRow,
): SpecialistMembershipRecord {
  if (row.role !== "BRAND_SPECIALIST" || row.status !== "ACTIVE") {
    throw new Error("Unexpected specialist membership state.");
  }

  return {
    id: row.id,
    brandId: row.brand_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    invitedBy: row.invited_by,
  };
}

async function getJoinableBrand({
  brandId,
  now,
}: {
  brandId: string;
  now: Date;
}) {
  const admin = createAdminClient();
  const [brandResult, entitlementResult] = await Promise.all([
    admin
      .from("brands")
      .select("id, name, status")
      .eq("id", brandId)
      .maybeSingle(),
    admin
      .from("brand_entitlements")
      .select("id, brand_id, status, starts_at, expires_at")
      .eq("brand_id", brandId)
      .eq("status", "ACTIVE"),
  ]);

  if (brandResult.error) {
    throw brandResult.error;
  }

  if (entitlementResult.error) {
    throw entitlementResult.error;
  }

  const brand = brandResult.data as BrandRow | null;
  const entitlements = (entitlementResult.data ?? []) as EntitlementRow[];

  if (!brand || !entitlements.some((row) => isActiveEntitlement(row, now))) {
    return null;
  }

  return brand;
}

async function insertInvitationAudit({
  actorUserId,
  actorRole,
  brandId,
  action,
  entityType,
  entityId,
  beforeJson = null,
  afterJson,
}: {
  actorUserId: string;
  actorRole: string | null;
  brandId: string;
  action: "member_invited" | "member_joined";
  entityType: string;
  entityId: string;
  beforeJson?: Record<string, unknown> | null;
  afterJson: Record<string, unknown>;
}) {
  await logAudit({
    actorUserId,
    actorRole,
    brandId,
    action,
    entityType,
    entityId,
    before: beforeJson,
    after: afterJson,
  });
}

export async function createSpecialistInvitation({
  input,
  inviterProfileId,
  inviterEmail,
  appOrigin,
}: {
  input: SpecialistInvitationInput;
  inviterProfileId: string;
  inviterEmail: string;
  appOrigin: string;
}): Promise<SpecialistInvitationResult> {
  const emailConfig = getResendEmailConfig();

  if (!emailConfig.ok) {
    invitationError(emailConfig.message);
  }

  const context = await getSpecialistInvitationContext(inviterProfileId);

  if (!context) {
    invitationError("You do not have permission to invite Brand Specialists.");
  }

  const created = await createAccessKey({
    type: "JOIN_BRAND",
    targetEmail: input.targetEmail,
    targetBrandId: context.brandId,
    targetRole: "BRAND_SPECIALIST",
    expiresAt: input.expiresAt,
    maxRedemptions: 1,
    createdByUserId: inviterProfileId,
    actorRole: context.membershipRole,
  });
  const invitationUrl = buildInvitationAcceptUrl({
    origin: appOrigin,
    rawKey: created.rawKey,
  });
  const email = buildSpecialistInvitationEmail({
    acceptUrl: invitationUrl,
    brandName: context.brandName,
    inviterEmail,
    expiresAt: input.expiresAt,
  });
  const emailResult = await sendEmailWithResend({
    to: input.targetEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
  let accessKey = created.accessKey;
  let resendEmailId: string | null = null;
  let warning: string | undefined;
  let deliveryStatus: "sent" | "sent_without_id" | "delivery_warning" =
    "sent";

  if (emailResult.ok) {
    resendEmailId = emailResult.id;

    if (resendEmailId) {
      try {
        accessKey = await updateAccessKeyEmailDelivery({
          accessKeyId: accessKey.id,
          resendEmailId,
        });
      } catch {
        warning = "Invitation email was sent, but its Resend id could not be stored.";
      }
    } else {
      deliveryStatus = "sent_without_id";
      warning = "Invitation email was sent, but Resend did not return an email id.";
    }
  } else {
    deliveryStatus = "delivery_warning";
    warning = emailResult.message;
  }

  await insertInvitationAudit({
    actorUserId: inviterProfileId,
    actorRole: context.membershipRole,
    brandId: context.brandId,
    action: "member_invited",
    entityType: "access_key",
    entityId: accessKey.id,
    afterJson: toMemberInvitedAudit({
      accessKey,
      targetEmail: input.targetEmail,
      deliveryStatus,
      resendEmailId,
    }),
  });

  return {
    accessKey,
    invitationUrl: emailResult.ok ? null : invitationUrl,
    resendEmailId,
    ...(warning ? { warning } : {}),
  };
}

export async function validateJoinBrandBeforeRedeem({
  accessKey,
  now,
}: {
  accessKey: AccessKeySafeRecord;
  now: Date;
}) {
  const keyFailure = validateJoinBrandAccessKey(accessKey);

  if (keyFailure) {
    return keyFailure;
  }

  const targetBrandId = accessKey.targetBrandId;

  if (!targetBrandId) {
    return failure(
      "INVALID_KEY_CONFIGURATION",
      "This invitation is missing a target brand.",
    );
  }

  const joinableBrand = await getJoinableBrand({
    brandId: targetBrandId,
    now,
  });

  if (!joinableBrand) {
    return failure(
      "JOIN_BRAND_NOT_AVAILABLE",
      "This brand workspace is not available for this invitation.",
    );
  }

  return null;
}

export async function acceptSpecialistInvitationForRedeemedAccessKey({
  accessKey,
  userId,
}: {
  accessKey: AccessKeySafeRecord;
  userId: string;
}) {
  const keyFailure = validateJoinBrandAccessKey(accessKey);

  if (keyFailure || !accessKey.targetBrandId) {
    throw new Error(
      keyFailure?.message ?? "This invitation cannot join a brand workspace.",
    );
  }

  const activation = await activateRedeemedBrandMembership({
    accessKeyId: accessKey.id,
    userId,
  });
  const membership = toSpecialistMembershipRecord({
    id: activation.membership.id,
    brand_id: activation.membership.brandId,
    user_id: activation.membership.userId,
    role: activation.membership.role,
    status: activation.membership.status,
    invited_by: activation.membership.invitedBy,
  });

  await insertInvitationAudit({
    actorUserId: userId,
    actorRole: membership.role,
    brandId: accessKey.targetBrandId,
    action: "member_joined",
    entityType: "brand_membership",
    entityId: membership.id,
    afterJson: toMemberJoinedAudit({
      accessKey,
      membership,
    }),
  });

  return {
    brand: activation.brand,
    membership,
  };
}
