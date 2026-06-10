import { failure } from "@/features/access/access-key-rules";
import { isCurrentActiveEntitlementWindow } from "@/features/access/entitlement-window";
import type { AccessKeySafeRecord } from "@/features/access/types";
import type {
  ClaimBrandEntitlementRecord,
  ClaimBrandMembershipRecord,
  ClaimBrandRecord,
} from "@/features/brands/claim-brand/types";

export function validateClaimBrandAccessKey(accessKey: AccessKeySafeRecord) {
  if (accessKey.type !== "CLAIM_BRAND") {
    return failure(
      "UNSUPPORTED_KEY_TYPE",
      "This access key cannot claim a brand.",
    );
  }

  if (!accessKey.targetBrandId) {
    return failure(
      "INVALID_KEY_CONFIGURATION",
      "This access key is missing a target brand.",
    );
  }

  if (accessKey.targetRole !== "OWNER") {
    return failure(
      "INVALID_KEY_CONFIGURATION",
      "CLAIM_BRAND keys must grant Owner access.",
    );
  }

  return null;
}

export function isCurrentActiveBrandEntitlement({
  entitlement,
  now = new Date(),
}: {
  entitlement: ClaimBrandEntitlementRecord;
  now?: Date;
}) {
  return isCurrentActiveEntitlementWindow({
    status: entitlement.status,
    startsAt: entitlement.startsAt,
    expiresAt: entitlement.expiresAt,
    now,
  });
}

export function findCurrentActiveBrandEntitlement({
  entitlements,
  now = new Date(),
}: {
  entitlements: ClaimBrandEntitlementRecord[];
  now?: Date;
}) {
  return (
    entitlements.find((entitlement) =>
      isCurrentActiveBrandEntitlement({ entitlement, now }),
    ) ?? null
  );
}

export function validateClaimableBrandAvailability({
  brand,
  entitlements,
  now = new Date(),
}: {
  brand: ClaimBrandRecord | null;
  entitlements: ClaimBrandEntitlementRecord[];
  now?: Date;
}) {
  if (!brand) {
    return failure(
      "CLAIM_BRAND_NOT_AVAILABLE",
      "This brand is not ready to be claimed.",
    );
  }

  if (!findCurrentActiveBrandEntitlement({ entitlements, now })) {
    return failure(
      "CLAIM_BRAND_NOT_AVAILABLE",
      "This brand is not ready to be claimed.",
    );
  }

  return null;
}

export function toBrandClaimedAudit({
  brand,
  membership,
  accessKey,
}: {
  brand: ClaimBrandRecord;
  membership: ClaimBrandMembershipRecord;
  accessKey: AccessKeySafeRecord;
}) {
  return {
    brand: {
      id: brand.id,
      name: brand.name,
      status: brand.status,
    },
    membership: {
      id: membership.id,
      role: membership.role,
      status: membership.status,
    },
    access_key: {
      id: accessKey.id,
      key_prefix: accessKey.keyPrefix,
      type: accessKey.type,
      target_brand_id: accessKey.targetBrandId,
      target_role: accessKey.targetRole,
    },
  };
}
