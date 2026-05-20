import "server-only";

import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import {
  canListFile,
  isBrandFileRole,
  isFileStatus,
  isFileVisibility,
} from "@/features/files/schema";
import type {
  BrandFileRecord,
  BrandFilesWorkspace,
  FileAccessContext,
  FileStatus,
  FileVisibility,
} from "@/features/files/types";
import { createAdminClient } from "@/lib/supabase/admin";

type FileRow = {
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

type ProfileRow = {
  id: string;
  email: string;
};

function safeVisibility(value: string): FileVisibility {
  return isFileVisibility(value) ? value : "HELIO_INTERNAL";
}

function safeStatus(value: string): FileStatus {
  return isFileStatus(value) ? value : "UPLOADED";
}

function toSizeBytes(value: number | string | null) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function toBrandFileRecord({
  row,
  uploaderEmail,
}: {
  row: FileRow;
  uploaderEmail?: string | null;
}): BrandFileRecord {
  return {
    id: row.id,
    brandId: row.brand_id,
    storagePath: row.storage_path,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: toSizeBytes(row.size_bytes),
    visibility: safeVisibility(row.visibility),
    status: safeStatus(row.status),
    uploadedBy: row.uploaded_by,
    uploadedByEmail: uploaderEmail ?? null,
    createdAt: row.created_at,
  };
}

export async function getFileAccessContextForProfile(
  profileId: string,
): Promise<FileAccessContext | null> {
  const accessSummary = await getBrandAccessSummaryForProfile(profileId);

  if (
    accessSummary.status !== "ACTIVE_ACCESS" ||
    !accessSummary.brandId ||
    !accessSummary.brandName ||
    !isBrandFileRole(accessSummary.membershipRole)
  ) {
    return null;
  }

  return {
    brandId: accessSummary.brandId,
    brandName: accessSummary.brandName,
    membershipRole: accessSummary.membershipRole,
    planName: accessSummary.planName,
  };
}

export async function getBrandFileById(fileId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("files")
    .select(
      "id, brand_id, storage_path, original_name, mime_type, size_bytes, visibility, status, uploaded_by, created_at",
    )
    .eq("id", fileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? toBrandFileRecord({ row: data as unknown as FileRow })
    : null;
}

export async function getBrandFilesWorkspace(
  profileId: string,
): Promise<BrandFilesWorkspace | null> {
  const access = await getFileAccessContextForProfile(profileId);

  if (!access) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("files")
    .select(
      "id, brand_id, storage_path, original_name, mime_type, size_bytes, visibility, status, uploaded_by, created_at",
    )
    .eq("brand_id", access.brandId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as FileRow[];
  const uploaderIds = Array.from(
    new Set(rows.map((row) => row.uploaded_by).filter(Boolean) as string[]),
  );
  const profilesResult =
    uploaderIds.length > 0
      ? await admin
          .from("users_profile")
          .select("id, email")
          .in("id", uploaderIds)
      : { data: [], error: null };

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  const emailsById = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [
      profile.id,
      profile.email,
    ]),
  );
  const files = rows
    .map((row) =>
      toBrandFileRecord({
        row,
        uploaderEmail: row.uploaded_by
          ? emailsById.get(row.uploaded_by) ?? null
          : null,
      }),
    )
    .filter((file) =>
      canListFile({
        file,
        role: access.membershipRole,
        profileId,
      }),
    );

  return {
    access,
    files,
  };
}
