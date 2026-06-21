import "server-only";

import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import {
  canListDocument,
  isBrandDocumentRole,
  isDocumentStatus,
  isDocumentVisibility,
} from "@/features/documents/schema";
import type {
  BrandDocumentRecord,
  BrandDocumentsWorkspace,
  DocumentAccessContext,
  DocumentStatus,
  DocumentVisibility,
} from "@/features/documents/types";
import {
  type PaginationInput,
  paginatedRows,
  toSupabaseRange,
} from "@/lib/pagination";
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
  approved_at: string | null;
};

type ProfileRow = {
  id: string;
  email: string;
};

function safeVisibility(value: string): DocumentVisibility {
  return isDocumentVisibility(value) ? value : "HELIO_INTERNAL";
}

function safeStatus(value: string): DocumentStatus {
  return isDocumentStatus(value) ? value : "UPLOADED";
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

export function toBrandDocumentRecord({
  row,
  uploaderEmail,
  uploaderLabel,
}: {
  row: FileRow;
  uploaderEmail?: string | null;
  uploaderLabel?: string | null;
}): BrandDocumentRecord {
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
    uploaderLabel: uploaderLabel ?? null,
    createdAt: row.created_at,
    approvedAt: row.approved_at ?? null,
  };
}

export async function getDocumentAccessContextForProfile(
  profileId: string,
): Promise<DocumentAccessContext | null> {
  const accessSummary = await getBrandAccessSummaryForProfile(profileId);

  if (
    accessSummary.status !== "ACTIVE_ACCESS" ||
    !accessSummary.brandId ||
    !accessSummary.brandName ||
    !isBrandDocumentRole(accessSummary.membershipRole)
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

export async function getBrandDocumentById(fileId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("files")
    .select(
      "id, brand_id, storage_path, original_name, mime_type, size_bytes, visibility, status, uploaded_by, created_at, approved_at",
    )
    .eq("id", fileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? toBrandDocumentRecord({ row: data as unknown as FileRow })
    : null;
}

export async function getBrandDocumentsWorkspace(
  profileId: string,
  paginationInput?: PaginationInput,
): Promise<BrandDocumentsWorkspace | null> {
  const access = await getDocumentAccessContextForProfile(profileId);

  if (!access) {
    return null;
  }

  const admin = createAdminClient();
  const range = toSupabaseRange(paginationInput);
  const { data, error } = await admin
    .from("files")
    .select(
      "id, brand_id, storage_path, original_name, mime_type, size_bytes, visibility, status, uploaded_by, created_at, approved_at",
    )
    .eq("brand_id", access.brandId)
    .neq("visibility", "OWNER_ONLY")
    .order("created_at", { ascending: false })
    .range(range.from, range.to + 1);

  if (error) {
    throw error;
  }

  const paginated = paginatedRows((data ?? []) as FileRow[], range);
  const rows = paginated.rows;
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
      toBrandDocumentRecord({
        row,
        uploaderEmail: row.uploaded_by
          ? emailsById.get(row.uploaded_by) ?? null
          : null,
      }),
    )
    .filter((file) =>
      canListDocument({
        file,
        role: access.membershipRole,
        profileId,
      }),
    );

  return {
    access,
    files,
    pagination: paginated.pagination,
  };
}
