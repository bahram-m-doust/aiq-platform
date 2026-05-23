import "server-only";

import { randomUUID } from "node:crypto";

import {
  buildStoragePath,
  isFileVisibility,
  toFileAuditMetadata,
} from "@/features/files/schema";
import {
  createPrivateFileSignedDownloadUrl,
  removePrivateFile,
  signedDownloadUrlTtlSeconds,
  uploadPrivateFile,
} from "@/features/files/storage";
import { toBrandFileRecord } from "@/features/files/queries";
import type {
  BrandFileRecord,
  FileVisibility,
} from "@/features/files/types";
import type { UserProfile } from "@/features/auth/types";
import { logAudit } from "@/lib/audit/logAudit";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

const CODE = "admin_file_service";

function adminFileError(message: string): never {
  throw new DomainError(CODE, message);
}

export function isAdminFileError(error: unknown): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}

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

const fileColumns =
  "id, brand_id, storage_path, original_name, mime_type, size_bytes, visibility, status, uploaded_by, created_at";

function readUploadFile(formData: FormData): File | null {
  const value = formData.get("file");
  return typeof File !== "undefined" && value instanceof File && value.size > 0
    ? value
    : null;
}

function readVisibility(formData: FormData): FileVisibility {
  const value = formData.get("visibility");
  return typeof value === "string" && isFileVisibility(value)
    ? value
    : "OWNER_ONLY";
}

export async function adminUploadFileForBrand({
  brandId,
  formData,
  actor,
}: {
  brandId: string;
  formData: FormData;
  actor: UserProfile;
}): Promise<BrandFileRecord> {
  const file = readUploadFile(formData);
  if (!file) adminFileError("Choose a file to upload.");

  const visibility = readVisibility(formData);

  const admin = createAdminClient();
  const brandResult = await admin
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .maybeSingle();

  if (brandResult.error) throw brandResult.error;
  if (!brandResult.data) adminFileError("Brand could not be found.");

  const fileId = randomUUID();
  const storagePath = buildStoragePath({
    brandId,
    fileId,
    originalName: file.name,
  });

  await uploadPrivateFile({
    storagePath,
    file,
    mimeType: file.type || null,
  });

  const { data, error } = await admin
    .from("files")
    .insert({
      id: fileId,
      brand_id: brandId,
      storage_path: storagePath,
      original_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      visibility,
      status: "UPLOADED",
      uploaded_by: actor.id,
    })
    .select(fileColumns)
    .single();

  if (error) {
    await removePrivateFile(storagePath);
    throw error;
  }

  const record = toBrandFileRecord({ row: data as unknown as FileRow });

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.global_role,
    brandId,
    action: "admin_file_uploaded",
    entityType: "file",
    entityId: record.id,
    after: { file: toFileAuditMetadata(record) },
  });

  return record;
}

async function getFileById(fileId: string): Promise<BrandFileRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("files")
    .select(fileColumns)
    .eq("id", fileId)
    .maybeSingle();

  if (error) throw error;
  return data ? toBrandFileRecord({ row: data as unknown as FileRow }) : null;
}

export async function adminArchiveFile({
  fileId,
  actor,
}: {
  fileId: string;
  actor: UserProfile;
}): Promise<BrandFileRecord> {
  const before = await getFileById(fileId);
  if (!before) adminFileError("File could not be found.");

  if (before.status === "ARCHIVED") {
    return before;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("files")
    .update({ status: "ARCHIVED" })
    .eq("id", fileId)
    .select(fileColumns)
    .single();

  if (error) throw error;

  const after = toBrandFileRecord({ row: data as unknown as FileRow });

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.global_role,
    brandId: after.brandId,
    action: "admin_file_archived",
    entityType: "file",
    entityId: after.id,
    before: { file: toFileAuditMetadata(before) },
    after: { file: toFileAuditMetadata(after) },
  });

  return after;
}

export async function adminDeleteFile({
  fileId,
  actor,
}: {
  fileId: string;
  actor: UserProfile;
}): Promise<{ id: string; brandId: string }> {
  const before = await getFileById(fileId);
  if (!before) adminFileError("File could not be found.");

  const admin = createAdminClient();
  const { error: deleteError } = await admin
    .from("files")
    .delete()
    .eq("id", fileId);

  if (deleteError) throw deleteError;

  try {
    await removePrivateFile(before.storagePath);
  } catch {
    // Best-effort: row is gone; the orphaned object can be reaped later.
  }

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.global_role,
    brandId: before.brandId,
    action: "admin_file_deleted",
    entityType: "file",
    entityId: before.id,
    before: { file: toFileAuditMetadata(before) },
  });

  return { id: before.id, brandId: before.brandId };
}

export async function adminCreateSignedDownloadUrl({
  fileId,
}: {
  fileId: string;
}): Promise<{ signedUrl: string; file: BrandFileRecord }> {
  const file = await getFileById(fileId);
  if (!file) adminFileError("File could not be found.");

  const signedUrl = await createPrivateFileSignedDownloadUrl({
    storagePath: file.storagePath,
    downloadName: file.originalName,
  });

  return { signedUrl, file };
}

export const adminFileSignedDownloadUrlTtlSeconds = signedDownloadUrlTtlSeconds;
