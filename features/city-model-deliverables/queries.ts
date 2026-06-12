import "server-only";

import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import {
  CITY_MODEL_DISTRICTS,
  getCityModelDistrictBySlug,
} from "@/features/app/city-model";
import {
  canReviewCityModelRole,
  toCityModelStatus,
} from "@/features/city-model-deliverables/schema";
import type {
  CityModelAdminDistrict,
  CityModelDeliverableRow,
  CityModelDeliverableStatus,
  CityModelDistrictWorkspace,
} from "@/features/city-model-deliverables/types";
import { resolveReviewSurface } from "@/features/review-content/surface";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/supabase/errors";

export async function getCityModelDeliverableRow(
  brandId: string,
  districtKey: string,
): Promise<CityModelDeliverableRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("city_model_district_files")
    .select("id, brand_id, district_key, file_id, status, uploaded_at, approved_at")
    .eq("brand_id", brandId)
    .eq("district_key", districtKey)
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  return (data as CityModelDeliverableRow | null) ?? null;
}

export async function getCityModelDistrictWorkspace({
  profileId,
  slug,
}: {
  profileId: string;
  slug: string;
}): Promise<CityModelDistrictWorkspace | null> {
  const district = getCityModelDistrictBySlug(slug);
  if (!district) return null;

  const access = await getBrandAccessSummaryForProfile(profileId);
  if (access.status !== "ACTIVE_ACCESS" || !access.brandId) {
    return null;
  }
  const canReview = canReviewCityModelRole(access.membershipRole);

  const row = await getCityModelDeliverableRow(access.brandId, district.key);
  const status = toCityModelStatus(row?.status);

  let fileName: string | null = null;
  let file: {
    id: string;
    storagePath: string;
    originalName: string;
    mimeType: string | null;
  } | null = null;
  if (row?.file_id) {
    const admin = createAdminClient();
    const { data: fileRow } = await admin
      .from("files")
      .select("storage_path, original_name, mime_type")
      .eq("id", row.file_id)
      .maybeSingle<{
        storage_path: string;
        original_name: string;
        mime_type: string | null;
      }>();
    if (fileRow) {
      fileName = fileRow.original_name;
      file = {
        id: row.file_id,
        storagePath: fileRow.storage_path,
        originalName: fileRow.original_name,
        mimeType: fileRow.mime_type,
      };
    }
  }

  const surface = await resolveReviewSurface({
    subjectType: "CITY_MODEL_DISTRICT",
    subjectId: district.slug,
    brandId: access.brandId,
    file,
  });

  return {
    district,
    brandId: access.brandId,
    status,
    // City Model's `signedUrl` is the inline preview; `downloadUrl` the download.
    signedUrl: surface.inlineUrl,
    downloadUrl: surface.signedUrl,
    fileName,
    markdown: surface.markdown,
    comments: surface.comments,
    canReview,
    uploadedAt: row?.uploaded_at ?? null,
    approvedAt: row?.approved_at ?? null,
  };
}

// Client grid: the brand's district statuses, keyed by district key. Districts
// with no row (or no access) are absent → the grid treats them as not-yet-ready.
export async function getCityModelDistrictStatuses(
  profileId: string,
): Promise<Record<string, CityModelDeliverableStatus>> {
  const access = await getBrandAccessSummaryForProfile(profileId);
  if (access.status !== "ACTIVE_ACCESS" || !access.brandId) {
    return {};
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("city_model_district_files")
    .select("district_key, status, file_id")
    .eq("brand_id", access.brandId);
  if (error) {
    if (isMissingTableError(error)) return {};
    throw error;
  }

  const map: Record<string, CityModelDeliverableStatus> = {};
  for (const row of (data ?? []) as Array<{
    district_key: string;
    status: string;
    file_id: string | null;
  }>) {
    // Only count a district as available once a file has actually been uploaded.
    if (row.file_id) {
      map[row.district_key] = toCityModelStatus(row.status);
    }
  }
  return map;
}

// Admin: every district for a brand with its current status. One query, mapped
// over the canonical district list so missing rows show as "PENDING_UPLOAD".
export async function getCityModelAdminDistricts(
  brandId: string,
): Promise<CityModelAdminDistrict[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("city_model_district_files")
    .select("district_key, status, file_id")
    .eq("brand_id", brandId);

  const rowByKey = new Map<string, { status: string; file_id: string | null }>();
  if (error) {
    if (!isMissingTableError(error)) throw error;
  } else {
    for (const row of (data ?? []) as Array<{
      district_key: string;
      status: string;
      file_id: string | null;
    }>) {
      rowByKey.set(row.district_key, {
        status: row.status,
        file_id: row.file_id,
      });
    }
  }

  // Resolve uploaded file names in one batch.
  const fileIds = Array.from(rowByKey.values())
    .map((r) => r.file_id)
    .filter((id): id is string => Boolean(id));
  const nameById = new Map<string, string>();
  if (fileIds.length > 0) {
    const { data: files } = await admin
      .from("files")
      .select("id, original_name")
      .in("id", fileIds);
    for (const f of (files ?? []) as Array<{ id: string; original_name: string }>) {
      nameById.set(f.id, f.original_name);
    }
  }

  return CITY_MODEL_DISTRICTS.map((district) => {
    const row = rowByKey.get(district.key);
    return {
      district,
      status: toCityModelStatus(row?.status),
      fileName: row?.file_id ? nameById.get(row.file_id) ?? null : null,
    };
  });
}

export async function getCityModelAdminBrands(): Promise<
  { id: string; name: string }[]
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brands")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as { id: string; name: string }[];
}
