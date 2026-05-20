import { failure } from "@/features/access/access-key-rules";
import type { AccessKeySafeRecord } from "@/features/access/types";
import { validateEmail } from "@/features/auth/schemas";
import type {
  AcceptInvitationFormState,
  InvitationManagerRole,
  SpecialistInvitationFormState,
  SpecialistInvitationInput,
  SpecialistMembershipRecord,
  SpecialistMembershipUpsert,
} from "@/features/invitations/types";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export const initialSpecialistInvitationFormState: SpecialistInvitationFormState =
  {
    status: "idle",
    message: "",
  };

export const initialAcceptInvitationFormState: AcceptInvitationFormState = {
  status: "idle",
  message: "",
};

function endOfUtcDay(dateValue: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString();
}

export function normalizeInvitationEmail(email: string) {
  return email.trim().toLowerCase();
}

export function canInviteSpecialistRole(
  role: string | null | undefined,
): role is InvitationManagerRole {
  return role === "OWNER" || role === "EXECUTIVE_MANAGER";
}

export function validateSpecialistInvitationFormData(formData: FormData): {
  data: SpecialistInvitationInput | null;
  error: string | null;
} {
  const targetEmail = normalizeInvitationEmail(
    readString(formData, "target_email"),
  );
  const expiresAt = endOfUtcDay(readString(formData, "expires_at"));

  if (!validateEmail(targetEmail)) {
    return { data: null, error: "Enter a valid specialist email address." };
  }

  if (!expiresAt) {
    return { data: null, error: "Choose a valid invitation expiry date." };
  }

  if (Date.parse(expiresAt) <= Date.now()) {
    return { data: null, error: "Choose a future invitation expiry date." };
  }

  return {
    data: {
      targetEmail,
      expiresAt,
    },
    error: null,
  };
}

export function validateAcceptInvitationFormData(formData: FormData) {
  const rawKey =
    readString(formData, "access_key") ||
    readString(formData, "key") ||
    readString(formData, "accessKey");

  if (!rawKey) {
    return { data: null, error: "Invitation key is missing." };
  }

  return { data: { rawKey }, error: null };
}

export function validateJoinBrandAccessKey(accessKey: AccessKeySafeRecord) {
  if (accessKey.type !== "JOIN_BRAND") {
    return failure(
      "UNSUPPORTED_KEY_TYPE",
      "This invitation cannot join a brand workspace.",
    );
  }

  if (!accessKey.targetBrandId) {
    return failure(
      "INVALID_KEY_CONFIGURATION",
      "This invitation is missing a target brand.",
    );
  }

  if (accessKey.targetRole !== "BRAND_SPECIALIST") {
    return failure(
      "INVALID_KEY_CONFIGURATION",
      "This invitation is not configured for Brand Specialist access.",
    );
  }

  return null;
}

export function buildSpecialistMembershipUpsert({
  brandId,
  userId,
  invitedBy,
}: {
  brandId: string;
  userId: string;
  invitedBy: string | null;
}): SpecialistMembershipUpsert {
  return {
    brand_id: brandId,
    user_id: userId,
    role: "BRAND_SPECIALIST",
    status: "ACTIVE",
    invited_by: invitedBy,
    expires_at: null,
  };
}

export function buildInvitationAcceptPath(rawKey: string) {
  return `/invite/accept?key=${encodeURIComponent(rawKey.trim())}`;
}

export function buildInvitationAcceptUrl({
  origin,
  rawKey,
}: {
  origin: string;
  rawKey: string;
}) {
  const baseUrl = new URL(origin);
  const acceptUrl = new URL(buildInvitationAcceptPath(rawKey), baseUrl);
  return acceptUrl.toString();
}

export function toMemberInvitedAudit({
  accessKey,
  targetEmail,
  deliveryStatus,
  resendEmailId,
}: {
  accessKey: AccessKeySafeRecord;
  targetEmail: string;
  deliveryStatus: "sent" | "sent_without_id" | "delivery_warning";
  resendEmailId: string | null;
}) {
  return {
    access_key: {
      id: accessKey.id,
      key_prefix: accessKey.keyPrefix,
      type: accessKey.type,
      target_brand_id: accessKey.targetBrandId,
      target_role: accessKey.targetRole,
      expires_at: accessKey.expiresAt,
      max_redemptions: accessKey.maxRedemptions,
    },
    target_email: targetEmail,
    delivery_status: deliveryStatus,
    resend_email_id: resendEmailId,
  };
}

export function toMemberJoinedAudit({
  accessKey,
  membership,
}: {
  accessKey: AccessKeySafeRecord;
  membership: SpecialistMembershipRecord;
}) {
  return {
    access_key: {
      id: accessKey.id,
      key_prefix: accessKey.keyPrefix,
      type: accessKey.type,
      target_brand_id: accessKey.targetBrandId,
      target_role: accessKey.targetRole,
      redeemed_by: accessKey.redeemedBy,
    },
    membership: {
      id: membership.id,
      role: membership.role,
      status: membership.status,
      invited_by: membership.invitedBy,
    },
  };
}
