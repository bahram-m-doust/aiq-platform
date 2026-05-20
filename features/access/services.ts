import "server-only";

import {
  buildAccessKeyNextAction,
  failure,
  isAccessKeyStatus,
  isAccessKeyType,
  normalizeMaxRedemptions,
  normalizeTargetEmail,
  validateAccessKeyConfiguration,
  validateAccessKeyForRedemption,
} from "@/features/access/access-key-rules";
import type {
  AccessKeyNextAction,
  AccessKeySafeRecord,
  AccessKeyType,
  AccessKeyStatus,
  CreateAccessKeyInput,
  CreateAccessKeyResult,
  RedeemAccessKeyFailure,
  RedeemAccessKeyResult,
} from "@/features/access/types";
import { generateAccessKey } from "@/lib/security/generateAccessKey";
import {
  hashAccessKey,
  normalizeAccessKey,
} from "@/lib/security/hashAccessKey";
import { logAudit } from "@/lib/audit/logAudit";
import { createAdminClient } from "@/lib/supabase/admin";

const accessKeySafeColumns = [
  "id",
  "key_prefix",
  "type",
  "status",
  "target_email",
  "target_brand_id",
  "target_role",
  "plan_id",
  "max_redemptions",
  "redeemed_count",
  "expires_at",
  "redeemed_by",
  "redeemed_at",
  "created_by",
  "created_at",
  "resend_email_id",
].join(", ");

type AccessKeyRow = {
  id: string;
  key_prefix: string;
  type: string;
  status: string;
  target_email: string | null;
  target_brand_id: string | null;
  target_role: string | null;
  plan_id: string | null;
  max_redemptions: number | null;
  redeemed_count: number | null;
  expires_at: string;
  redeemed_by: string | null;
  redeemed_at: string | null;
  created_by: string | null;
  created_at: string | null;
  resend_email_id: string | null;
};

type RedeemAccessKeyInput = {
  rawKey: string;
  userId: string;
  userEmail: string;
  actorRole?: string | null;
  now?: Date;
  allowedTypes?: AccessKeyType[];
  beforeRedeem?: (input: {
    accessKey: AccessKeySafeRecord;
    nextAction: AccessKeyNextAction;
    userId: string;
    userEmail: string;
    now: Date;
  }) => Promise<RedeemAccessKeyFailure | null>;
};

type AuditAction =
  | "access_key_created"
  | "access_key_redeemed"
  | "access_key_failed";

type AuditJson = Record<string, unknown>;

function toIsoTimestamp(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Access keys require a valid expiry timestamp.");
  }

  return date.toISOString();
}

function toFutureIsoTimestamp(value: Date | string) {
  const expiresAt = toIsoTimestamp(value);

  if (Date.parse(expiresAt) <= Date.now()) {
    throw new Error("Access keys require a future expiry timestamp.");
  }

  return expiresAt;
}

function toAccessKeySafeRecord(row: AccessKeyRow): AccessKeySafeRecord {
  if (!isAccessKeyType(row.type)) {
    throw new Error("Unsupported access key type.");
  }

  if (!isAccessKeyStatus(row.status)) {
    throw new Error("Unsupported access key status.");
  }

  return {
    id: row.id,
    keyPrefix: row.key_prefix,
    type: row.type,
    status: row.status,
    targetEmail: row.target_email,
    targetBrandId: row.target_brand_id,
    targetRole: row.target_role,
    planId: row.plan_id,
    maxRedemptions: row.max_redemptions ?? 1,
    redeemedCount: row.redeemed_count ?? 0,
    expiresAt: row.expires_at,
    redeemedBy: row.redeemed_by,
    redeemedAt: row.redeemed_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    resendEmailId: row.resend_email_id,
  };
}

function toAuditAccessKey(accessKey: AccessKeySafeRecord): AuditJson {
  return {
    id: accessKey.id,
    key_prefix: accessKey.keyPrefix,
    type: accessKey.type,
    status: accessKey.status,
    target_brand_id: accessKey.targetBrandId,
    target_role: accessKey.targetRole,
    plan_id: accessKey.planId,
    max_redemptions: accessKey.maxRedemptions,
    redeemed_count: accessKey.redeemedCount,
    redeemed_by: accessKey.redeemedBy,
    redeemed_at: accessKey.redeemedAt,
    created_by: accessKey.createdBy,
    created_at: accessKey.createdAt,
    resend_email_id: accessKey.resendEmailId,
  };
}

async function insertAccessKeyAuditLog({
  action,
  actorUserId,
  actorRole,
  accessKey,
  beforeJson = null,
  afterJson = null,
}: {
  action: AuditAction;
  actorUserId: string;
  actorRole?: string | null;
  accessKey: AccessKeySafeRecord | null;
  beforeJson?: AuditJson | null;
  afterJson?: AuditJson | null;
}) {
  await logAudit({
    actorUserId,
    actorRole,
    brandId: accessKey?.targetBrandId ?? null,
    action,
    entityType: "access_key",
    entityId: accessKey?.id ?? null,
    before: beforeJson,
    after: afterJson,
  });
}

async function auditAccessKeyFailure({
  actorUserId,
  actorRole,
  accessKey,
  failureResult,
}: {
  actorUserId: string;
  actorRole?: string | null;
  accessKey: AccessKeySafeRecord | null;
  failureResult: RedeemAccessKeyFailure;
}) {
  await insertAccessKeyAuditLog({
    action: "access_key_failed",
    actorUserId,
    actorRole,
    accessKey,
    beforeJson: accessKey ? { access_key: toAuditAccessKey(accessKey) } : null,
    afterJson: {
      outcome: "failed",
      code: failureResult.code,
    },
  });
}

async function expireAccessKey(accessKey: AccessKeySafeRecord) {
  if (accessKey.status !== "ACTIVE") {
    return accessKey;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("access_keys")
    .update({ status: "EXPIRED" satisfies AccessKeyStatus })
    .eq("id", accessKey.id)
    .eq("status", "ACTIVE")
    .select(accessKeySafeColumns)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? toAccessKeySafeRecord(data as unknown as AccessKeyRow)
    : { ...accessKey, status: "EXPIRED" as AccessKeyStatus };
}

export async function createAccessKey(
  input: CreateAccessKeyInput,
): Promise<CreateAccessKeyResult> {
  const generated = generateAccessKey();
  const expiresAt = toFutureIsoTimestamp(input.expiresAt);
  const maxRedemptions = normalizeMaxRedemptions(input.maxRedemptions);
  const targetEmail = normalizeTargetEmail(input.targetEmail);

  const draftAccessKey: AccessKeySafeRecord = {
    id: "pending",
    keyPrefix: generated.keyPrefix,
    type: input.type,
    status: "ACTIVE",
    targetEmail,
    targetBrandId: input.targetBrandId ?? null,
    targetRole: input.targetRole ?? null,
    planId: input.planId ?? null,
    maxRedemptions,
    redeemedCount: 0,
    expiresAt,
    redeemedBy: null,
    redeemedAt: null,
    createdBy: input.createdByUserId,
    createdAt: null,
    resendEmailId: null,
  };
  const configurationFailure = validateAccessKeyConfiguration(draftAccessKey);

  if (configurationFailure) {
    throw new Error(configurationFailure.message);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("access_keys")
    .insert({
      key_hash: generated.keyHash,
      key_prefix: generated.keyPrefix,
      type: input.type,
      status: "ACTIVE",
      target_email: targetEmail,
      target_brand_id: input.targetBrandId ?? null,
      target_role: input.targetRole ?? null,
      plan_id: input.planId ?? null,
      max_redemptions: maxRedemptions,
      redeemed_count: 0,
      expires_at: expiresAt,
      created_by: input.createdByUserId,
    })
    .select(accessKeySafeColumns)
    .single();

  if (error) {
    throw error;
  }

  const accessKey = toAccessKeySafeRecord(data as unknown as AccessKeyRow);
  await insertAccessKeyAuditLog({
    action: "access_key_created",
    actorUserId: input.createdByUserId,
    actorRole: input.actorRole,
    accessKey,
    afterJson: {
      outcome: "created",
      access_key: toAuditAccessKey(accessKey),
    },
  });

  return {
    rawKey: generated.rawKey,
    accessKey,
  };
}

export async function updateAccessKeyEmailDelivery({
  accessKeyId,
  resendEmailId,
}: {
  accessKeyId: string;
  resendEmailId: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("access_keys")
    .update({ resend_email_id: resendEmailId })
    .eq("id", accessKeyId)
    .select(accessKeySafeColumns)
    .single();

  if (error) {
    throw error;
  }

  return toAccessKeySafeRecord(data as unknown as AccessKeyRow);
}

export async function redeemAccessKey({
  rawKey,
  userId,
  userEmail,
  actorRole = null,
  now = new Date(),
  allowedTypes,
  beforeRedeem,
}: RedeemAccessKeyInput): Promise<RedeemAccessKeyResult> {
  const normalizedRawKey = normalizeAccessKey(rawKey);

  if (!normalizedRawKey) {
    const result = failure("MISSING_KEY", "Enter an access key.");
    await auditAccessKeyFailure({
      actorUserId: userId,
      actorRole,
      accessKey: null,
      failureResult: result,
    });
    return result;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("access_keys")
    .select(accessKeySafeColumns)
    .eq("key_hash", hashAccessKey(normalizedRawKey))
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    const result = failure("INVALID_KEY", "This access key is invalid.");
    await auditAccessKeyFailure({
      actorUserId: userId,
      actorRole,
      accessKey: null,
      failureResult: result,
    });
    return result;
  }

  let accessKey = toAccessKeySafeRecord(data as unknown as AccessKeyRow);
  const validationFailure = validateAccessKeyForRedemption({
    accessKey,
    userEmail,
    now,
  });

  if (validationFailure) {
    if (validationFailure.code === "EXPIRED_KEY") {
      accessKey = await expireAccessKey(accessKey);
    }

    await auditAccessKeyFailure({
      actorUserId: userId,
      actorRole,
      accessKey,
      failureResult: validationFailure,
    });
    return validationFailure;
  }

  if (allowedTypes && !allowedTypes.includes(accessKey.type)) {
    const result = failure(
      "UNSUPPORTED_KEY_TYPE",
      "This access key cannot be used for this activation step.",
    );
    await auditAccessKeyFailure({
      actorUserId: userId,
      actorRole,
      accessKey,
      failureResult: result,
    });
    return result;
  }

  const nextAction = buildAccessKeyNextAction(accessKey);

  if (!nextAction) {
    const result = failure(
      "INVALID_KEY_CONFIGURATION",
      "This access key is not configured for redemption.",
    );
    await auditAccessKeyFailure({
      actorUserId: userId,
      actorRole,
      accessKey,
      failureResult: result,
    });
    return result;
  }

  if (beforeRedeem) {
    const preRedemptionFailure = await beforeRedeem({
      accessKey,
      nextAction,
      userId,
      userEmail,
      now,
    });

    if (preRedemptionFailure) {
      await auditAccessKeyFailure({
        actorUserId: userId,
        actorRole,
        accessKey,
        failureResult: preRedemptionFailure,
      });
      return preRedemptionFailure;
    }
  }

  const redeemedAt = now.toISOString();
  const redeemedCount = accessKey.redeemedCount + 1;
  const status: AccessKeyStatus =
    redeemedCount >= accessKey.maxRedemptions ? "REDEEMED" : "ACTIVE";

  const { data: updatedData, error: updateError } = await admin
    .from("access_keys")
    .update({
      redeemed_count: redeemedCount,
      redeemed_by: userId,
      redeemed_at: redeemedAt,
      status,
    })
    .eq("id", accessKey.id)
    .eq("status", "ACTIVE")
    .eq("redeemed_count", accessKey.redeemedCount)
    .lt("redeemed_count", accessKey.maxRedemptions)
    .gt("expires_at", redeemedAt)
    .select(accessKeySafeColumns)
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  if (!updatedData) {
    const result = failure(
      "REDEMPTION_CONFLICT",
      "This access key could not be redeemed. Try again.",
    );
    await auditAccessKeyFailure({
      actorUserId: userId,
      actorRole,
      accessKey,
      failureResult: result,
    });
    return result;
  }

  const redeemedAccessKey = toAccessKeySafeRecord(
    updatedData as unknown as AccessKeyRow,
  );
  await insertAccessKeyAuditLog({
    action: "access_key_redeemed",
    actorUserId: userId,
    actorRole,
    accessKey: redeemedAccessKey,
    beforeJson: { access_key: toAuditAccessKey(accessKey) },
    afterJson: {
      outcome: "redeemed",
      access_key: toAuditAccessKey(redeemedAccessKey),
      next_action: nextAction.kind,
    },
  });

  return {
    ok: true,
    accessKey: redeemedAccessKey,
    nextAction,
  };
}
