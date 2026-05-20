import "server-only";

import { resolveBrandAccessSummary } from "@/features/access/access-summary";
import type {
  BrandAccessEntitlement,
  BrandAccessMembership,
} from "@/features/access/types";
import { createAdminClient } from "@/lib/supabase/admin";

type RelatedRecord<T> = T | T[] | null;

type BrandRecord = {
  id: string;
  name: string;
};

type PlanRecord = {
  name: string | null;
};

type MembershipRow = {
  brand_id: string;
  role: string;
  brands: RelatedRecord<BrandRecord>;
};

type EntitlementRow = {
  brand_id: string;
  status: string;
  starts_at: string | null;
  expires_at: string | null;
  plans: RelatedRecord<PlanRecord>;
};

function firstRelated<T>(record: RelatedRecord<T>) {
  return Array.isArray(record) ? (record[0] ?? null) : record;
}

export async function getBrandAccessSummaryForProfile(profileId: string) {
  const admin = createAdminClient();
  const { data: membershipData, error: membershipError } = await admin
    .from("brand_memberships")
    .select("brand_id, role, brands(id, name)")
    .eq("user_id", profileId)
    .eq("status", "ACTIVE");

  if (membershipError) {
    throw membershipError;
  }

  const memberships = ((membershipData ?? []) as MembershipRow[])
    .map<BrandAccessMembership | null>((membership) => {
      const brand = firstRelated(membership.brands);

      if (!brand) {
        return null;
      }

      return {
        brandId: membership.brand_id,
        brandName: brand.name,
        role: membership.role,
      };
    })
    .filter((membership): membership is BrandAccessMembership =>
      Boolean(membership),
    );

  if (memberships.length === 0) {
    return resolveBrandAccessSummary({ memberships: [], entitlements: [] });
  }

  const brandIds = memberships.map((membership) => membership.brandId);
  const { data: entitlementData, error: entitlementError } = await admin
    .from("brand_entitlements")
    .select("brand_id, status, starts_at, expires_at, plans(name)")
    .in("brand_id", brandIds)
    .eq("status", "ACTIVE");

  if (entitlementError) {
    throw entitlementError;
  }

  const entitlements = ((entitlementData ?? []) as EntitlementRow[]).map(
    (entitlement): BrandAccessEntitlement => {
      const plan = firstRelated(entitlement.plans);

      return {
        brandId: entitlement.brand_id,
        status: entitlement.status,
        startsAt: entitlement.starts_at,
        expiresAt: entitlement.expires_at,
        planName: plan?.name ?? null,
      };
    },
  );

  return resolveBrandAccessSummary({ memberships, entitlements });
}
