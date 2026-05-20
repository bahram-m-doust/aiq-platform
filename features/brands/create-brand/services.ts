import "server-only";

import { grantBrandAccess } from "@/features/access/grant-brand-access";
import {
  buildBrandModuleRows,
  calculatePlanGrantExpiresAt,
  parseIncludedModuleTypes,
  validateCreateBrandAccessKeyContext,
} from "@/features/brands/create-brand/schema";
import type {
  CreateBrandAccessKeyContext,
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

type IdRow = {
  id: string;
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

async function markAccessKeyFulfilled({
  accessKeyId,
  brandId,
  userId,
  nowIso,
}: {
  accessKeyId: string;
  brandId: string;
  userId: string;
  nowIso: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("access_keys")
    .update({ target_brand_id: brandId })
    .eq("id", accessKeyId)
    .eq("type", "CREATE_BRAND")
    .eq("status", "REDEEMED")
    .eq("redeemed_by", userId)
    .is("target_brand_id", null)
    .gt("expires_at", nowIso)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function deleteCreatedBrand(brandId: string) {
  const admin = createAdminClient();
  await admin.from("brands").delete().eq("id", brandId);
}

function toBrandCreatedAudit({
  brand,
  context,
  membershipId,
  intakeSessionId,
  entitlementId,
  moduleTypes,
}: {
  brand: BrandRow;
  context: CreateBrandAccessKeyContext;
  membershipId: string;
  intakeSessionId: string;
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
      id: context.accessKey.id,
      key_prefix: context.accessKey.keyPrefix,
      type: context.accessKey.type,
    },
    membership_id: membershipId,
    membership_role: "OWNER",
    intake_session_id: intakeSessionId,
    plan_id: context.plan?.id ?? null,
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
  const now = new Date();
  const nowIso = now.toISOString();
  const contextResult = await getCreateBrandAccessKeyContext({
    accessKeyId,
    profileId: userId,
    userEmail,
    now,
  });

  if (!contextResult.ok) {
    throw new Error(contextResult.message);
  }

  const context = contextResult.context;
  const moduleTypes = parseIncludedModuleTypes(context.plan?.includedModules);
  const admin = createAdminClient();
  const { data: brandData, error: brandError } = await admin
    .from("brands")
    .insert({
      name: brandName,
      industry,
      website,
      status: "CREATED",
      created_by: userId,
    })
    .select("id, name, industry, website, status")
    .single();

  if (brandError) {
    throw brandError;
  }

  const brand = brandData as unknown as BrandRow;
  const fulfilled = await markAccessKeyFulfilled({
    accessKeyId,
    brandId: brand.id,
    userId,
    nowIso,
  });

  if (!fulfilled) {
    await deleteCreatedBrand(brand.id);
    throw new Error("This CREATE_BRAND key has already been fulfilled.");
  }

  const { data: membershipData, error: membershipError } = await admin
    .from("brand_memberships")
    .insert({
      brand_id: brand.id,
      user_id: userId,
      role: "OWNER",
      status: "ACTIVE",
    })
    .select("id")
    .single();

  if (membershipError) {
    throw membershipError;
  }

  const { data: intakeSessionData, error: intakeSessionError } = await admin
    .from("intake_sessions")
    .insert({
      brand_id: brand.id,
      status: "DRAFT",
      completion_percent: 0,
    })
    .select("id")
    .single();

  if (intakeSessionError) {
    throw intakeSessionError;
  }

  const moduleRows = buildBrandModuleRows({
    brandId: brand.id,
    moduleTypes,
  });

  if (moduleRows.length > 0) {
    const { error: moduleError } = await admin
      .from("brand_modules")
      .insert(moduleRows);

    if (moduleError) {
      throw moduleError;
    }
  }

  const entitlement = context.plan
    ? await grantBrandAccess({
        brandId: brand.id,
        planId: context.plan.id,
        source: "ACCESS_KEY",
        startsAt: nowIso,
        expiresAt: calculatePlanGrantExpiresAt(
          nowIso,
          context.plan.durationDays,
        ),
        grantedByUserId: userId,
        actorRole,
      })
    : null;

  const membershipId = (membershipData as unknown as IdRow).id;
  const intakeSessionId = (intakeSessionData as unknown as IdRow).id;
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
      context,
      membershipId,
      intakeSessionId,
      entitlementId: entitlement?.entitlement.id ?? null,
      moduleTypes,
    }),
  });

  return {
    brandId: brand.id,
    membershipId,
    intakeSessionId,
    entitlement,
    moduleCount: moduleRows.length,
  };
}
