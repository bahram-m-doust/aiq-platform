import type {
  AccessKeyFailureCode,
  AccessKeyNextAction,
  AccessKeySafeRecord,
  AccessKeyStatus,
  AccessKeyType,
  RedeemAccessKeyFailure,
} from "@/features/access/types";
import { accessKeyStatuses, accessKeyTypes } from "@/features/access/types";

export type AccessKeyValidationFailure = RedeemAccessKeyFailure;

export function isAccessKeyType(value: string): value is AccessKeyType {
  return accessKeyTypes.includes(value as AccessKeyType);
}

export function isAccessKeyStatus(value: string): value is AccessKeyStatus {
  return accessKeyStatuses.includes(value as AccessKeyStatus);
}

export function normalizeAccessKeyEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeTargetEmail(email: string | null | undefined) {
  if (!email) {
    return null;
  }

  const normalized = normalizeAccessKeyEmail(email);
  return normalized.length > 0 ? normalized : null;
}

export function normalizeMaxRedemptions(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return 1;
  }

  if (!Number.isInteger(value) || value < 1) {
    throw new Error("Access keys require at least one redemption.");
  }

  return value;
}

function parseTimestamp(value: string) {
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

export function isAccessKeyExpired(expiresAt: string, now = new Date()) {
  const expiresAtTime = parseTimestamp(expiresAt);

  if (expiresAtTime === null) {
    return true;
  }

  return expiresAtTime <= now.getTime();
}

export function failure(
  code: AccessKeyFailureCode,
  message: string,
): AccessKeyValidationFailure {
  return { ok: false, code, message };
}

export function validateAccessKeyConfiguration(
  accessKey: Pick<AccessKeySafeRecord, "type" | "targetBrandId">,
) {
  if (
    (accessKey.type === "CLAIM_BRAND" ||
      accessKey.type === "JOIN_BRAND" ||
      accessKey.type === "SUPPORT_ACCESS") &&
    !accessKey.targetBrandId
  ) {
    return failure(
      "INVALID_KEY_CONFIGURATION",
      "This access key is not configured for redemption.",
    );
  }

  return null;
}

export function validateAccessKeyForRedemption({
  accessKey,
  userEmail,
  now = new Date(),
}: {
  accessKey: AccessKeySafeRecord;
  userEmail: string;
  now?: Date;
}) {
  if (accessKey.status !== "ACTIVE") {
    if (accessKey.status === "REDEEMED") {
      return failure("ALREADY_REDEEMED", "This access key has already been redeemed.");
    }

    if (accessKey.status === "EXPIRED") {
      return failure("EXPIRED_KEY", "This access key has expired.");
    }

    if (accessKey.status === "REVOKED") {
      return failure("REVOKED_KEY", "This access key has been revoked.");
    }

    return failure("INVALID_KEY_STATUS", "This access key is not active.");
  }

  if (isAccessKeyExpired(accessKey.expiresAt, now)) {
    return failure("EXPIRED_KEY", "This access key has expired.");
  }

  if (accessKey.redeemedCount >= accessKey.maxRedemptions) {
    return failure("ALREADY_REDEEMED", "This access key has already been redeemed.");
  }

  if (
    accessKey.targetEmail &&
    normalizeAccessKeyEmail(accessKey.targetEmail) !==
      normalizeAccessKeyEmail(userEmail)
  ) {
    return failure(
      "EMAIL_MISMATCH",
      "This access key is assigned to another email address.",
    );
  }

  return validateAccessKeyConfiguration(accessKey);
}

export function buildAccessKeyNextAction(
  accessKey: AccessKeySafeRecord,
): AccessKeyNextAction | null {
  switch (accessKey.type) {
    case "CREATE_BRAND":
      return {
        kind: "CREATE_BRAND_REQUIRED",
        accessKeyId: accessKey.id,
        keyType: accessKey.type,
        planId: accessKey.planId,
      };
    case "CLAIM_BRAND":
      if (!accessKey.targetBrandId) {
        return null;
      }

      return {
        kind: "CLAIM_BRAND_REQUIRED",
        accessKeyId: accessKey.id,
        keyType: accessKey.type,
        targetBrandId: accessKey.targetBrandId,
        targetRole: accessKey.targetRole,
        planId: accessKey.planId,
      };
    case "JOIN_BRAND":
      if (!accessKey.targetBrandId) {
        return null;
      }

      return {
        kind: "JOIN_BRAND_REQUIRED",
        accessKeyId: accessKey.id,
        keyType: accessKey.type,
        targetBrandId: accessKey.targetBrandId,
        targetRole: accessKey.targetRole,
        planId: accessKey.planId,
      };
    case "DEMO_ACCESS":
      return {
        kind: "DEMO_ACCESS_CONTINUE",
        accessKeyId: accessKey.id,
        keyType: accessKey.type,
        targetBrandId: accessKey.targetBrandId,
        targetRole: accessKey.targetRole,
        planId: accessKey.planId,
      };
    case "SUPPORT_ACCESS":
      if (!accessKey.targetBrandId) {
        return null;
      }

      return {
        kind: "SUPPORT_ACCESS_CONTINUE",
        accessKeyId: accessKey.id,
        keyType: accessKey.type,
        targetBrandId: accessKey.targetBrandId,
        targetRole: accessKey.targetRole,
        planId: accessKey.planId,
      };
    default:
      return null;
  }
}
