import "server-only";

import type { BrainBuildSchedule } from "@/features/admin/brain-build/types";
import { createAdminClient } from "@/lib/supabase/admin";

type ScheduleRow = {
  brand_id: string;
  target_date: string;
  scheduled_by: string | null;
  built_at: string | null;
  built_by: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function toSchedule(row: ScheduleRow): BrainBuildSchedule {
  return {
    brandId: row.brand_id,
    targetDate: row.target_date,
    scheduledBy: row.scheduled_by,
    builtAt: row.built_at,
    builtBy: row.built_by,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT =
  "brand_id, target_date, scheduled_by, built_at, built_by, notes, created_at, updated_at";

export async function getBrainBuildScheduleForBrand(
  brandId: string,
): Promise<BrainBuildSchedule | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brain_build_schedule")
    .select(SELECT)
    .eq("brand_id", brandId)
    .maybeSingle();

  if (error) {
    // Table not migrated yet, or a transient error — treat as unscheduled so
    // the roadmap still renders (the "waiting for Bextudio" state).
    return null;
  }

  return data ? toSchedule(data as ScheduleRow) : null;
}

// Batch lookup for the admin brands list — one query for every visible brand.
export async function getBrainBuildSchedulesForBrands(
  brandIds: string[],
): Promise<Map<string, BrainBuildSchedule>> {
  const result = new Map<string, BrainBuildSchedule>();
  if (brandIds.length === 0) {
    return result;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brain_build_schedule")
    .select(SELECT)
    .in("brand_id", brandIds);

  if (error) {
    return result;
  }

  for (const row of (data ?? []) as ScheduleRow[]) {
    result.set(row.brand_id, toSchedule(row));
  }
  return result;
}
