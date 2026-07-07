import "server-only";

import { toBrandDocumentRecord } from "@/features/documents/queries";
import type { BrandDocumentRecord } from "@/features/documents/types";
import {
  type PaginationInput,
  type PaginationState,
  paginatedRows,
  toSupabaseRange,
} from "@/lib/pagination";
import { createAdminClient } from "@/lib/supabase/admin";

type FileRowForBrand = {
  id: string;
  brand_id: string;
  storage_path: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | string | null;
  visibility: string;
  status: string;
  uploaded_by: string | null;
  created_at: string | null;
  approved_at: string | null;
};

export type AdminBrandOption = {
  id: string;
  name: string;
  status: string;
};

type BrandOptionRow = {
  id: string;
  name: string;
  status: string;
};

type ProfileRow = {
  id: string;
  email: string;
  global_role: string;
};

// Platform staff uploads are branded "AIQ STUDIO"; everything else (a brand's
// own user uploading their files) is attributed to the brand itself.
const STAFF_ROLES = new Set([
  "PLATFORM_OWNER",
  "SUPERVISOR",
  "INTERNAL_SPECIALIST",
]);
const PLATFORM_LABEL = "AIQ STUDIO";

export async function getAdminBrandOptions(): Promise<AdminBrandOption[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brands")
    .select("id, name, status")
    .order("name", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as BrandOptionRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
  }));
}

export async function getDocumentsForBrand({
  brandId,
  pagination,
}: {
  brandId: string;
  pagination?: PaginationInput;
}): Promise<{ files: BrandDocumentRecord[]; pagination: PaginationState }> {
  const admin = createAdminClient();
  const range = toSupabaseRange(pagination ?? {});
  const { data, error } = await admin
    .from("files")
    .select(
      "id, brand_id, storage_path, original_name, mime_type, size_bytes, visibility, status, uploaded_by, created_at, approved_at",
    )
    .eq("brand_id", brandId)
    .not("status", "eq", "CLIENT_REVIEW")
    .order("created_at", { ascending: false })
    .range(range.from, range.to + 1);

  if (error) throw error;

  // paginatedRows trims the extra look-ahead row; enrich only the page's rows.
  const { rows, pagination: paginationState } = paginatedRows(
    (data ?? []) as FileRowForBrand[],
    range,
  );
  const uploaderIds = Array.from(
    new Set(rows.map((row) => row.uploaded_by).filter(Boolean) as string[]),
  );
  const [profileResult, brandResult] = await Promise.all([
    uploaderIds.length > 0
      ? admin
          .from("users_profile")
          .select("id, email, global_role")
          .in("id", uploaderIds)
      : Promise.resolve({ data: [], error: null }),
    admin.from("brands").select("name").eq("id", brandId).maybeSingle(),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (brandResult.error) throw brandResult.error;

  const brandName =
    (brandResult.data as { name: string } | null)?.name ?? PLATFORM_LABEL;

  const profilesById = new Map(
    ((profileResult.data ?? []) as ProfileRow[]).map((profile) => [
      profile.id,
      profile,
    ]),
  );

  return {
    files: rows.map((row) => {
      const uploader = row.uploaded_by
        ? profilesById.get(row.uploaded_by) ?? null
        : null;
      // Staff (or unknown uploader) -> "AIQ STUDIO"; a brand's own user -> brand.
      const uploaderLabel =
        uploader && !STAFF_ROLES.has(uploader.global_role)
          ? brandName
          : PLATFORM_LABEL;

      return toBrandDocumentRecord({
        row,
        uploaderEmail: uploader?.email ?? null,
        uploaderLabel,
      });
    }),
    pagination: paginationState,
  };
}
