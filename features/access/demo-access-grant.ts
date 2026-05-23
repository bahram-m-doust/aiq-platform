import "server-only";

import { grantBrandAccess } from "@/features/access/grant-brand-access";
import type { AccessKeySafeRecord } from "@/features/access/types";
import type { BrandRole } from "@/features/admin/types";
import { logAudit } from "@/lib/audit/logAudit";
import { createAdminClient } from "@/lib/supabase/admin";

type MembershipRow = {
  id: string;
  brand_id: string;
  user_id: string;
  role: string;
  status: string;
};

export type ActivateDemoAccessInput = {
  accessKey: AccessKeySafeRecord;
  brandId: string;
  planId: string;
  userId: string;
  userEmail: string;
  actorRole?: string | null;
};

function defaultDemoRole(value: string | null | undefined): BrandRole {
  return value === "OWNER" ||
    value === "EXECUTIVE_MANAGER" ||
    value === "BRAND_SPECIALIST"
    ? (value as BrandRole)
    : "BRAND_SPECIALIST";
}

export async function activateDemoAccessForUser({
  accessKey,
  brandId,
  planId,
  userId,
  userEmail,
  actorRole,
}: ActivateDemoAccessInput) {
  const role = defaultDemoRole(accessKey.targetRole);
  const admin = createAdminClient();

  const { data: membershipData, error: membershipError } = await admin
    .from("brand_memberships")
    .upsert(
      {
        brand_id: brandId,
        user_id: userId,
        role,
        status: "ACTIVE",
        invited_by: accessKey.createdBy,
        expires_at: accessKey.expiresAt,
      },
      { onConflict: "brand_id,user_id,role" },
    )
    .select("id, brand_id, user_id, role, status")
    .single();

  if (membershipError) {
    throw membershipError;
  }

  const membership = membershipData as unknown as MembershipRow;

  const grant = await grantBrandAccess({
    brandId,
    planId,
    source: "DEMO",
    startsAt: new Date(),
    expiresAt: accessKey.expiresAt,
    grantedByUserId: userId,
    actorRole,
    manualReference: `access_key:${accessKey.id}`,
    internalNote: "Granted via DEMO_ACCESS key redemption",
  });

  await logAudit({
    actorUserId: userId,
    actorRole: actorRole ?? null,
    action: "access_key_redeemed",
    entityType: "brand_membership",
    entityId: membership.id,
    after: {
      access_key_id: accessKey.id,
      brand_id: brandId,
      plan_id: planId,
      role,
      source: "DEMO",
      target_email: userEmail,
    },
  });

  return { membership, entitlement: grant.entitlement };
}
