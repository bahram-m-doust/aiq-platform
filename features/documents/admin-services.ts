import "server-only";

import { randomUUID } from "node:crypto";

import {
  buildStoragePath,
  isDocumentVisibility,
  toDocumentAuditMetadata,
} from "@/features/documents/schema";
import {
  createPrivateFileSignedDownloadUrl,
  removePrivateFile,
  signedDownloadUrlTtlSeconds,
  uploadPrivateFile,
} from "@/features/documents/storage";
import { toBrandDocumentRecord } from "@/features/documents/queries";
import type {
  BrandDocumentRecord,
  DocumentVisibility,
} from "@/features/documents/types";
import type { UserProfile } from "@/features/auth/types";
import { logAudit } from "@/lib/audit/logAudit";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

const CODE = "admin_file_service";

function adminFileError(message: string): never {
  throw new DomainError(CODE, message);
}

export function isAdminDocumentError(error: unknown): error is DomainError {
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

function readVisibility(formData: FormData): DocumentVisibility {
  const value = formData.get("visibility");
  return typeof value === "string" && isDocumentVisibility(value)
    ? value
    : "OWNER_ONLY";
}

export async function adminUploadDocumentForBrand({
  brandId,
  formData,
  actor,
}: {
  brandId: string;
  formData: FormData;
  actor: UserProfile;
}): Promise<BrandDocumentRecord> {
  const file = readUploadFile(formData);
  if (!file) adminFileError("Choose a document to upload.");

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

  const record = toBrandDocumentRecord({ row: data as unknown as FileRow });

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.global_role,
    brandId,
    action: "admin_file_uploaded",
    entityType: "file",
    entityId: record.id,
    after: { file: toDocumentAuditMetadata(record) },
  });

  return record;
}

async function getFileById(fileId: string): Promise<BrandDocumentRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("files")
    .select(fileColumns)
    .eq("id", fileId)
    .maybeSingle();

  if (error) throw error;
  return data ? toBrandDocumentRecord({ row: data as unknown as FileRow }) : null;
}

export async function adminArchiveDocument({
  fileId,
  actor,
}: {
  fileId: string;
  actor: UserProfile;
}): Promise<BrandDocumentRecord> {
  const before = await getFileById(fileId);
  if (!before) adminFileError("Document could not be found.");

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

  const after = toBrandDocumentRecord({ row: data as unknown as FileRow });

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.global_role,
    brandId: after.brandId,
    action: "admin_file_archived",
    entityType: "file",
    entityId: after.id,
    before: { file: toDocumentAuditMetadata(before) },
    after: { file: toDocumentAuditMetadata(after) },
  });

  return after;
}

export async function adminUnarchiveDocument({
  fileId,
  actor,
}: {
  fileId: string;
  actor: UserProfile;
}): Promise<BrandDocumentRecord> {
  const before = await getFileById(fileId);
  if (!before) adminFileError("Document could not be found.");

  if (before.status !== "ARCHIVED") {
    return before;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("files")
    .update({ status: "UPLOADED" })
    .eq("id", fileId)
    .select(fileColumns)
    .single();

  if (error) throw error;

  const after = toBrandDocumentRecord({ row: data as unknown as FileRow });

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.global_role,
    brandId: after.brandId,
    action: "admin_file_unarchived",
    entityType: "file",
    entityId: after.id,
    before: { file: toDocumentAuditMetadata(before) },
    after: { file: toDocumentAuditMetadata(after) },
  });

  return after;
}

export async function adminDeleteDocument({
  fileId,
  actor,
}: {
  fileId: string;
  actor: UserProfile;
}): Promise<{ id: string; brandId: string }> {
  const before = await getFileById(fileId);
  if (!before) adminFileError("Document could not be found.");

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
    before: { file: toDocumentAuditMetadata(before) },
  });

  return { id: before.id, brandId: before.brandId };
}

export async function adminCreateSignedDownloadUrl({
  fileId,
}: {
  fileId: string;
}): Promise<{ signedUrl: string; file: BrandDocumentRecord }> {
  const file = await getFileById(fileId);
  if (!file) adminFileError("Document could not be found.");

  const signedUrl = await createPrivateFileSignedDownloadUrl({
    storagePath: file.storagePath,
    downloadName: file.originalName,
  });

  return { signedUrl, file };
}

export async function adminPromoteDocumentToRag({
  fileId,
  actor,
}: {
  fileId: string;
  actor: UserProfile;
}): Promise<BrandDocumentRecord> {
  const before = await getFileById(fileId);
  if (!before) adminFileError("Document could not be found.");

  if (before.status === "ARCHIVED") {
    adminFileError("Cannot promote an archived document to RAG.");
  }

  if (before.status === "RAG_APPROVED") {
    return before;
  }

  const admin = createAdminClient();

  const { data, error: updateError } = await admin
    .from("files")
    .update({ status: "RAG_APPROVED" })
    .eq("id", fileId)
    .select(fileColumns)
    .single();

  if (updateError) throw updateError;

  const after = toBrandDocumentRecord({ row: data as unknown as FileRow });

  const { error: knowledgeError } = await admin
    .from("knowledge_files")
    .upsert(
      {
        brand_id: after.brandId,
        module_id: null,
        file_id: fileId,
        rag_status: "RAG_APPROVED",
        approved_by_supervisor: actor.id,
        approved_by_platform_owner: actor.id,
      },
      { onConflict: "brand_id, file_id" },
    );

  if (knowledgeError) throw knowledgeError;

  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.global_role,
    brandId: after.brandId,
    action: "admin_file_rag_promoted",
    entityType: "file",
    entityId: after.id,
    before: { file: toDocumentAuditMetadata(before) },
    after: { file: toDocumentAuditMetadata(after) },
  });

  return after;
}

export const adminFileSignedDownloadUrlTtlSeconds = signedDownloadUrlTtlSeconds;
