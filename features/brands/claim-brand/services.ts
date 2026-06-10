import "server-only";

import { failure } from "@/features/access/access-key-rules";
import { activateRedeemedBrandMembership } from "@/features/access/redeemed-brand-membership";
import type { AccessKeySafeRecord } from "@/features/access/types";
import {
  findCurrentActiveBrandEntitlement,
  toBrandClaimedAudit,
  validateClaimableBrandAvailability,
  validateClaimBrandAccessKey,
} from "@/features/brands/claim-brand/schema";
import type {
  ClaimBrandEntitlementRecord,
  ClaimBrandMembershipRecord,
  ClaimBrandPreRedemptionInput,
  ClaimBrandPreRedemptionResult,
  ClaimBrandRecord,
  ClaimBrandResult,
} from "@/features/brands/claim-brand/types";
import { logAudit } from "@/lib/audit/logAudit";
import { createAdminClient } from "@/lib/supabase/admin";

type BrandRow = {
  id: string;
  name: string;
  status: string;
};

type EntitlementRow = {
  id: string;
  brand_id: string;
  plan_id: string;
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
};

function toClaimBrandRecord(row: BrandRow): ClaimBrandRecord {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
  };
}

function toClaimBrandEntitlementRecord(
  row: EntitlementRow,
): ClaimBrandEntitlementRecord {
  return {
    id: row.id,
    brandId: row.brand_id,
    planId: row.plan_id,
    status: row.status,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
  };
}

function toClaimBrandMembershipRecord(
  row: MembershipRow,
): ClaimBrandMembershipRecord {
  if (row.role !== "OWNER" || row.status !== "ACTIVE") {
    throw new Error("Unexpected claim membership state.");
  }

  return {
    id: row.id,
    brandId: row.brand_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
  };
}

async function getClaimableBrand({
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
      .select("id, brand_id, plan_id, status, starts_at, expires_at")
      .eq("brand_id", brandId)
      .eq("status", "ACTIVE"),
  ]);

  if (brandResult.error) {
    throw brandResult.error;
  }

  if (entitlementResult.error) {
    throw entitlementResult.error;
  }

  const entitlements = ((entitlementResult.data ?? []) as EntitlementRow[]).map(
    toClaimBrandEntitlementRecord,
  );
  const brand = brandResult.data
    ? toClaimBrandRecord(brandResult.data as unknown as BrandRow)
    : null;
  const availabilityFailure = validateClaimableBrandAvailability({
    brand,
    entitlements,
    now,
  });

  if (availabilityFailure || !brand) {
    return null;
  }

  const activeEntitlement = findCurrentActiveBrandEntitlement({
    entitlements,
    now,
  });

  if (!activeEntitlement) {
    return null;
  }

  return {
    brand,
    entitlement: activeEntitlement,
  };
}

export async function validateClaimBrandBeforeRedeem({
  accessKey,
  now,
}: ClaimBrandPreRedemptionInput): ClaimBrandPreRedemptionResult {
  const keyFailure = validateClaimBrandAccessKey(accessKey);

  if (keyFailure) {
    return keyFailure;
  }

  const targetBrandId = accessKey.targetBrandId;

  if (!targetBrandId) {
    return failure(
      "INVALID_KEY_CONFIGURATION",
      "This access key is missing a target brand.",
    );
  }

  const claimableBrand = await getClaimableBrand({
    brandId: targetBrandId,
    now,
  });

  if (!claimableBrand) {
    return failure(
      "CLAIM_BRAND_NOT_AVAILABLE",
      "This brand is not ready to be claimed.",
    );
  }

  return null;
}

export async function claimBrandForRedeemedAccessKey({
  accessKey,
  userId,
  actorRole = null,
}: {
  accessKey: AccessKeySafeRecord;
  userId: string;
  actorRole?: string | null;
}): Promise<ClaimBrandResult> {
  const keyFailure = validateClaimBrandAccessKey(accessKey);

  if (keyFailure || !accessKey.targetBrandId) {
    throw new Error(
      keyFailure?.message ?? "This access key cannot claim a brand.",
    );
  }

  const activation = await activateRedeemedBrandMembership({
    accessKeyId: accessKey.id,
    userId,
  });
  const brand = toClaimBrandRecord(activation.brand);
  const membership = toClaimBrandMembershipRecord({
    id: activation.membership.id,
    brand_id: activation.membership.brandId,
    user_id: activation.membership.userId,
    role: activation.membership.role,
    status: activation.membership.status,
  });
  await logAudit({
    actorUserId: userId,
    actorRole,
    brandId: brand.id,
    action: "brand_claimed",
    entityType: "brand",
    entityId: brand.id,
    before: null,
    after: toBrandClaimedAudit({
      brand,
      membership,
      accessKey,
    }),
  });

  return {
    brand,
    membership,
  };
}
