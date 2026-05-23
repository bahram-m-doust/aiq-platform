import "server-only";

import { randomUUID } from "node:crypto";

import {
  buildStoragePath,
  canDownloadFile,
  canReviewSpecialistFile,
  canUploadFileRole,
  statusForUploadedFile,
  toFileAuditMetadata,
  validateFileUploadFormData,
} from "@/features/files/schema";
import {
  getBrandFileById,
  getFileAccessContextForProfile,
} from "@/features/files/queries";
import {
  createPrivateFileSignedDownloadUrl,
  removePrivateFile,
  signedDownloadUrlTtlSeconds,
  uploadPrivateFile,
} from "@/features/files/storage";
import type {
  BrandFileRecord,
  FileReviewDecision,
} from "@/features/files/types";
import { logAudit } from "@/lib/audit/logAudit";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

const CODE = "file_service";

function fileServiceError(message: string): never {
  throw new DomainError(CODE, message);
}

export function isFileServiceError(error: unknown): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}

async function insertFileAuditLog({
  actorUserId,
  actorRole,
  brandId,
  action,
  file,
  beforeJson = null,
  afterJson,
}: {
  actorUserId: string;
  actorRole: string | null;
  brandId: string;
  action: "file_uploaded" | "file_downloaded" | "specialist_file_approved";
  file: BrandFileRecord;
  beforeJson?: Record<string, unknown> | null;
  afterJson: Record<string, unknown>;
}) {
  await logAudit({
    actorUserId,
    actorRole,
    brandId,
    action,
    entityType: "file",
    entityId: file.id,
    before: beforeJson,
    after: afterJson,
  });
}

async function uploaderIsBrandSpecialist({
  brandId,
  uploaderId,
}: {
  brandId: string;
  uploaderId: string | null;
}) {
  if (!uploaderId) {
    return false;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brand_memberships")
    .select("id")
    .eq("brand_id", brandId)
    .eq("user_id", uploaderId)
    .eq("role", "BRAND_SPECIALIST")
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function uploadBrandFileFromFormData({
  formData,
  profileId,
}: {
  formData: FormData;
  profileId: string;
}) {
  const access = await getFileAccessContextForProfile(profileId);

  if (!access || !canUploadFileRole(access.membershipRole)) {
    fileServiceError("You do not have permission to upload files.");
  }

  const validation = validateFileUploadFormData({
    formData,
    role: access.membershipRole,
  });

  if (validation.error || !validation.data) {
    fileServiceError(validation.error ?? "File upload details are invalid.");
  }

  const fileId = randomUUID();
  const file = validation.data.file;
  const status = statusForUploadedFile(access.membershipRole);
  const storagePath = buildStoragePath({
    brandId: access.brandId,
    fileId,
    originalName: file.name,
  });

  await uploadPrivateFile({
    storagePath,
    file,
    mimeType: file.type || null,
  });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("files")
    .insert({
      id: fileId,
      brand_id: access.brandId,
      storage_path: storagePath,
      original_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      visibility: validation.data.visibility,
      status,
      uploaded_by: profileId,
    })
    .select(
      "id, brand_id, storage_path, original_name, mime_type, size_bytes, visibility, status, uploaded_by, created_at",
    )
    .single();

  if (error) {
    await removePrivateFile(storagePath);
    throw error;
  }

  const record = {
    id: data.id,
    brandId: data.brand_id,
    storagePath: data.storage_path,
    originalName: data.original_name,
    mimeType: data.mime_type,
    sizeBytes:
      typeof data.size_bytes === "number"
        ? data.size_bytes
        : Number(data.size_bytes),
    visibility: validation.data.visibility,
    status,
    uploadedBy: data.uploaded_by,
    uploadedByEmail: null,
    createdAt: data.created_at,
  } satisfies BrandFileRecord;

  await insertFileAuditLog({
    actorUserId: profileId,
    actorRole: access.membershipRole,
    brandId: access.brandId,
    action: "file_uploaded",
    file: record,
    afterJson: {
      file: toFileAuditMetadata(record),
      specialist_upload_pending: status === "PENDING_OWNER_APPROVAL",
    },
  });

  return record;
}

export async function createSignedDownloadUrlForFile({
  fileId,
  profileId,
}: {
  fileId: string;
  profileId: string;
}) {
  const access = await getFileAccessContextForProfile(profileId);

  if (!access) {
    fileServiceError("You do not have permission to download this file.");
  }

  const file = await getBrandFileById(fileId);

  if (!file || file.brandId !== access.brandId) {
    fileServiceError("File could not be found.");
  }

  if (
    !canDownloadFile({
      file,
      role: access.membershipRole,
      profileId,
    })
  ) {
    fileServiceError("You do not have permission to download this file.");
  }

  const signedUrl = await createPrivateFileSignedDownloadUrl({
    storagePath: file.storagePath,
    downloadName: file.originalName,
  });

  await insertFileAuditLog({
    actorUserId: profileId,
    actorRole: access.membershipRole,
    brandId: access.brandId,
    action: "file_downloaded",
    file,
    afterJson: {
      file: toFileAuditMetadata(file),
      signed_url_expires_in_seconds: signedDownloadUrlTtlSeconds,
    },
  });

  return { signedUrl, file };
}

export async function reviewSpecialistFile({
  fileId,
  profileId,
  decision,
}: {
  fileId: string;
  profileId: string;
  decision: FileReviewDecision;
}) {
  const access = await getFileAccessContextForProfile(profileId);

  if (!access) {
    fileServiceError("You do not have permission to review this file.");
  }

  const file = await getBrandFileById(fileId);

  if (!file || file.brandId !== access.brandId) {
    fileServiceError("File could not be found.");
  }

  if (
    !canReviewSpecialistFile({
      file,
      role: access.membershipRole,
    })
  ) {
    fileServiceError("You do not have permission to review this file.");
  }

  const specialistUpload = await uploaderIsBrandSpecialist({
    brandId: access.brandId,
    uploaderId: file.uploadedBy,
  });

  if (!specialistUpload) {
    fileServiceError("Only Brand Specialist uploads can be reviewed here.");
  }

  const nextStatus =
    decision === "APPROVE" ? "OWNER_APPROVED" : "OWNER_REJECTED";
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("files")
    .update({ status: nextStatus })
    .eq("id", file.id)
    .eq("brand_id", access.brandId)
    .eq("status", "PENDING_OWNER_APPROVAL")
    .select(
      "id, brand_id, storage_path, original_name, mime_type, size_bytes, visibility, status, uploaded_by, created_at",
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    fileServiceError("File review could not be completed.");
  }

  const reviewedFile = {
    ...file,
    status: nextStatus,
  } satisfies BrandFileRecord;

  await insertFileAuditLog({
    actorUserId: profileId,
    actorRole: access.membershipRole,
    brandId: access.brandId,
    action: "specialist_file_approved",
    file: reviewedFile,
    beforeJson: {
      file: toFileAuditMetadata(file),
    },
    afterJson: {
      file: toFileAuditMetadata(reviewedFile),
      decision,
    },
  });

  return reviewedFile;
}
