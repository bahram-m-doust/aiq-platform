import "server-only";

import {
  auditBrandAccessGrant,
  toGrantBrandAccessResult,
  type BrandAccessGrantRpcRow,
} from "@/features/access/grant-brand-access";
import type { AccessKeySafeRecord } from "@/features/access/types";
import type { BrandRole } from "@/features/admin/types";
import { logAudit } from "@/lib/audit/logAudit";
import { createAdminClient } from "@/lib/supabase/admin";

type MembershipRow = {
  membership_id: string;
  membership_brand_id: string;
  membership_user_id: string;
  membership_role: string;
  membership_status: string;
};

type DemoAccessActivationRow = MembershipRow & BrandAccessGrantRpcRow;

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

  const { data, error } = await admin.rpc("activate_demo_access_atomic", {
    p_brand_id: brandId,
    p_plan_id: planId,
    p_user_id: userId,
    p_role: role,
    p_invited_by: accessKey.createdBy,
    p_expires_at: accessKey.expiresAt,
    p_idempotency_key: accessKey.id,
  });
  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as
    | DemoAccessActivationRow
    | null;
  if (!row) {
    throw new Error("Demo access transaction returned no result.");
  }

  const membership = {
    id: row.membership_id,
    brand_id: row.membership_brand_id,
    user_id: row.membership_user_id,
    role: row.membership_role,
    status: row.membership_status,
  };
  const grant = toGrantBrandAccessResult(row);

  await auditBrandAccessGrant({
    result: grant,
    actorUserId: userId,
    actorRole,
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
