import "server-only";

import {
  auditBrandAccessGrant,
  toGrantBrandAccessResult,
  type BrandAccessGrantRpcRow,
} from "@/features/access/grant-brand-access";
import {
  validateCreateBrandAccessKeyContext,
} from "@/features/brands/create-brand/schema";
import type {
  CreateBrandAccessKeyRecord,
  CreateBrandContextResult,
  CreateBrandFormInput,
  CreateBrandPlanRecord,
  CreatedBrandResult,
} from "@/features/brands/create-brand/types";
import { logAudit } from "@/lib/audit/logAudit";
import { createAdminClient } from "@/lib/supabase/admin";

const accessKeyColumns = [
  "id",
  "key_prefix",
  "type",
  "status",
  "target_email",
  "target_brand_id",
  "plan_id",
  "expires_at",
  "redeemed_by",
].join(", ");

type AccessKeyRow = {
  id: string;
  key_prefix: string;
  type: string;
  status: string;
  target_email: string | null;
  target_brand_id: string | null;
  plan_id: string | null;
  expires_at: string;
  redeemed_by: string | null;
};

type PlanRow = {
  id: string;
  name: string;
  duration_days: number | null;
  included_modules: unknown;
};

type BrandRow = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  status: string;
};

type AtomicBrandCreationRow = {
  created_brand_id: string;
  created_brand_name: string;
  created_brand_industry: string | null;
  created_brand_website: string | null;
  created_brand_status: string;
  created_membership_id: string;
  created_intake_session_id: string;
  used_access_key_id: string;
  used_access_key_prefix: string;
  used_plan_id: string | null;
  created_module_types: string[] | null;
  created_module_count: number;
  entitlement_id: string | null;
  entitlement_brand_id: string | null;
  entitlement_plan_id: string | null;
  entitlement_source: string | null;
  entitlement_status: string | null;
  entitlement_starts_at: string | null;
  entitlement_expires_at: string | null;
  entitlement_granted_by: string | null;
  entitlement_manual_reference: string | null;
  entitlement_internal_note: string | null;
  entitlement_created_at: string | null;
  included_agent_keys: string[] | null;
  matched_agent_keys: string[] | null;
  agent_entitlement_count: number;
};

function toAccessKeyRecord(row: AccessKeyRow): CreateBrandAccessKeyRecord {
  return {
    id: row.id,
    keyPrefix: row.key_prefix,
    type: row.type,
    status: row.status,
    targetEmail: row.target_email,
    targetBrandId: row.target_brand_id,
    planId: row.plan_id,
    expiresAt: row.expires_at,
    redeemedBy: row.redeemed_by,
  };
}

function toPlanRecord(row: PlanRow): CreateBrandPlanRecord {
  return {
    id: row.id,
    name: row.name,
    durationDays: row.duration_days,
    includedModules: row.included_modules,
  };
}

async function loadPlan(planId: string): Promise<CreateBrandPlanRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("plans")
    .select("id, name, duration_days, included_modules")
    .eq("id", planId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toPlanRecord(data as unknown as PlanRow) : null;
}

export async function getCreateBrandAccessKeyContext({
  accessKeyId,
  profileId,
  userEmail,
  now = new Date(),
}: {
  accessKeyId: string;
  profileId: string;
  userEmail: string;
  now?: Date;
}): Promise<CreateBrandContextResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("access_keys")
    .select(accessKeyColumns)
    .eq("id", accessKeyId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      ok: false,
      message: "This access key cannot create a brand.",
    };
  }

  const accessKey = toAccessKeyRecord(data as unknown as AccessKeyRow);
  const validationError = validateCreateBrandAccessKeyContext({
    accessKey,
    profileId,
    userEmail,
    now,
  });

  if (validationError) {
    return { ok: false, message: validationError };
  }

  let plan: CreateBrandPlanRecord | null = null;

  if (accessKey.planId) {
    plan = await loadPlan(accessKey.planId);

    if (!plan) {
      return {
        ok: false,
        message: "The plan attached to this access key is not active.",
      };
    }
  }

  return {
    ok: true,
    context: {
      accessKey,
      plan,
    },
  };
}

function toBrandCreatedAudit({
  brand,
  accessKeyId,
  accessKeyPrefix,
  membershipId,
  intakeSessionId,
  planId,
  entitlementId,
  moduleTypes,
}: {
  brand: BrandRow;
  accessKeyId: string;
  accessKeyPrefix: string;
  membershipId: string;
  intakeSessionId: string;
  planId: string | null;
  entitlementId: string | null;
  moduleTypes: string[];
}) {
  return {
    brand: {
      id: brand.id,
      name: brand.name,
      industry: brand.industry,
      website: brand.website,
      status: brand.status,
    },
    access_key: {
      id: accessKeyId,
      key_prefix: accessKeyPrefix,
      type: "CREATE_BRAND",
    },
    membership_id: membershipId,
    membership_role: "OWNER",
    intake_session_id: intakeSessionId,
    plan_id: planId,
    entitlement_id: entitlementId,
    module_types: moduleTypes,
    module_count: moduleTypes.length,
  };
}

export async function createBrandFromCreateBrandAccessKey({
  accessKeyId,
  brandName,
  industry,
  website,
  userId,
  userEmail,
  actorRole,
}: CreateBrandFormInput & {
  userId: string;
  userEmail: string;
  actorRole?: string | null;
}): Promise<CreatedBrandResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc(
    "create_brand_from_access_key_atomic",
    {
      p_access_key_id: accessKeyId,
      p_brand_name: brandName,
      p_industry: industry,
      p_website: website,
      p_user_id: userId,
      p_user_email: userEmail,
    },
  );
  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as
    | AtomicBrandCreationRow
    | null;
  if (!row) {
    throw new Error("Brand creation transaction returned no result.");
  }

  const brand: BrandRow = {
    id: row.created_brand_id,
    name: row.created_brand_name,
    industry: row.created_brand_industry,
    website: row.created_brand_website,
    status: row.created_brand_status,
  };
  const moduleTypes = row.created_module_types ?? [];
  const entitlement = row.entitlement_id
    ? toGrantBrandAccessResult(
        row as unknown as BrandAccessGrantRpcRow,
      )
    : null;

  if (entitlement) {
    await auditBrandAccessGrant({
      result: entitlement,
      actorUserId: userId,
      actorRole,
    });
  }

  await logAudit({
    actorUserId: userId,
    actorRole: actorRole ?? null,
    brandId: brand.id,
    action: "brand_created",
    entityType: "brand",
    entityId: brand.id,
    before: null,
    after: toBrandCreatedAudit({
      brand,
      accessKeyId: row.used_access_key_id,
      accessKeyPrefix: row.used_access_key_prefix,
      membershipId: row.created_membership_id,
      intakeSessionId: row.created_intake_session_id,
      planId: row.used_plan_id,
      entitlementId: entitlement?.entitlement.id ?? null,
      moduleTypes,
    }),
  });

  return {
    brandId: brand.id,
    membershipId: row.created_membership_id,
    intakeSessionId: row.created_intake_session_id,
    entitlement,
    moduleCount: row.created_module_count,
  };
}
