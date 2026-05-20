import type {
  BrandAccessEntitlement,
  BrandAccessMembership,
  BrandAccessSummary,
} from "@/features/access/types";

export const noBrandAccessSummary: BrandAccessSummary = {
  status: "NO_ACCESS",
  brandId: null,
  brandName: null,
  membershipRole: null,
  planName: null,
};

function parseTime(value: string | null) {
  if (!value) {
    return null;
  }

  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

export function isActiveBrandEntitlement(
  entitlement: BrandAccessEntitlement,
  now = new Date(),
) {
  if (entitlement.status !== "ACTIVE") {
    return false;
  }

  const nowTime = now.getTime();
  const startsAt = parseTime(entitlement.startsAt);
  const expiresAt = parseTime(entitlement.expiresAt);

  if (startsAt !== null && startsAt > nowTime) {
    return false;
  }

  if (expiresAt !== null && expiresAt <= nowTime) {
    return false;
  }

  return true;
}

export function resolveBrandAccessSummary({
  memberships,
  entitlements,
  now = new Date(),
}: {
  memberships: BrandAccessMembership[];
  entitlements: BrandAccessEntitlement[];
  now?: Date;
}): BrandAccessSummary {
  for (const membership of memberships) {
    const entitlement = entitlements.find(
      (item) =>
        item.brandId === membership.brandId &&
        isActiveBrandEntitlement(item, now),
    );

    if (entitlement) {
      return {
        status: "ACTIVE_ACCESS",
        brandId: membership.brandId,
        brandName: membership.brandName,
        membershipRole: membership.role,
        planName: entitlement.planName,
      };
    }
  }

  return noBrandAccessSummary;
}
