import "server-only";

import { toBrandFileRecord } from "@/features/files/queries";
import type { BrandFileRecord } from "@/features/files/types";
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
};

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

export async function getFilesForBrand({
  brandId,
}: {
  brandId: string;
}): Promise<BrandFileRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("files")
    .select(
      "id, brand_id, storage_path, original_name, mime_type, size_bytes, visibility, status, uploaded_by, created_at",
    )
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as FileRowForBrand[];
  const uploaderIds = Array.from(
    new Set(rows.map((row) => row.uploaded_by).filter(Boolean) as string[]),
  );
  const profileResult =
    uploaderIds.length > 0
      ? await admin
          .from("users_profile")
          .select("id, email")
          .in("id", uploaderIds)
      : { data: [], error: null };

  if (profileResult.error) throw profileResult.error;

  const emailsById = new Map(
    ((profileResult.data ?? []) as ProfileRow[]).map((profile) => [
      profile.id,
      profile.email,
    ]),
  );

  return rows.map((row) =>
    toBrandFileRecord({
      row,
      uploaderEmail: row.uploaded_by
        ? emailsById.get(row.uploaded_by) ?? null
        : null,
    }),
  );
}
