import "server-only";

import type {
  AdminAccessKeyFormOptions,
  AdminBrandOption,
  AdminPlanOption,
} from "@/features/admin/types";
import { cacheSharedConfig } from "@/lib/cache/shared";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { createAdminClient } from "@/lib/supabase/admin";

type PlanRow = {
  id: string;
  name: string;
};

type BrandRow = {
  id: string;
  name: string;
  status: string;
};

const getActivePlanOptions = cacheSharedConfig(
  async (): Promise<AdminPlanOption[]> => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("plans")
      .select("id, name")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return ((data ?? []) as PlanRow[]).map((plan) => ({
      id: plan.id,
      name: plan.name,
    }));
  },
  ["active-plan-options"],
  {
    revalidate: 3600,
    tags: [CACHE_TAGS.activePlans],
  },
);

export async function getAdminAccessKeyFormOptions(): Promise<AdminAccessKeyFormOptions> {
  const admin = createAdminClient();
  const [plans, brandsResult] = await Promise.all([
    getActivePlanOptions(),
    admin
      .from("brands")
      .select("id, name, status")
      .order("name", { ascending: true }),
  ]);

  if (brandsResult.error) {
    throw brandsResult.error;
  }

  return {
    plans,
    brands: ((brandsResult.data ?? []) as BrandRow[]).map(
      (brand): AdminBrandOption => ({
        id: brand.id,
        name: brand.name,
        status: brand.status,
      }),
    ),
  };
}

export async function getManualGrantFormOptions() {
  return getAdminAccessKeyFormOptions();
}

export async function verifyAdminAccessKeyReferences({
  planId,
  targetBrandId,
}: {
  planId: string | null;
  targetBrandId: string | null;
}) {
  const admin = createAdminClient();
  const [planResult, brandResult] = await Promise.all([
    planId
      ? admin
          .from("plans")
          .select("id")
          .eq("id", planId)
          .eq("is_active", true)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    targetBrandId
      ? admin
          .from("brands")
          .select("id")
          .eq("id", targetBrandId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (planResult.error) {
    throw planResult.error;
  }

  if (brandResult.error) {
    throw brandResult.error;
  }

  return {
    planExists: planId ? Boolean(planResult.data) : true,
    brandExists: targetBrandId ? Boolean(brandResult.data) : true,
  };
}
