import "server-only";

import { randomUUID } from "node:crypto";

import {
  buildStoragePath,
  canDownloadDocument,
  canReviewSpecialistDocument,
  canUploadDocumentRole,
  statusForUploadedDocument,
  toDocumentAuditMetadata,
  validateDocumentUploadFormData,
} from "@/features/documents/schema";
import {
  getBrandDocumentById,
  getDocumentAccessContextForProfile,
} from "@/features/documents/queries";
import {
  createPrivateFileSignedDownloadUrl,
  signedDownloadUrlTtlSeconds,
  uploadPrivateFile,
} from "@/features/documents/storage";
import {
  processPendingStorageCleanups,
  removePrivateFileOrQueue,
} from "@/features/documents/storage-cleanup";
import type {
  BrandDocumentRecord,
  DocumentReviewDecision,
} from "@/features/documents/types";
import { logAudit } from "@/lib/audit/logAudit";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateSecureUpload } from "@/lib/security/file-upload";

const CODE = "file_service";

function fileServiceError(message: string): never {
  throw new DomainError(CODE, message);
}

export function isDocumentServiceError(error: unknown): error is DomainError {
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
  file: BrandDocumentRecord;
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

export async function uploadBrandDocumentFromFormData({
  formData,
  profileId,
}: {
  formData: FormData;
  profileId: string;
}) {
  const access = await getDocumentAccessContextForProfile(profileId);

  if (!access || !canUploadDocumentRole(access.membershipRole)) {
    fileServiceError("You do not have permission to upload documents.");
  }

  const validation = validateDocumentUploadFormData({
    formData,
    role: access.membershipRole,
  });

  if (validation.error || !validation.data) {
    fileServiceError(validation.error ?? "Document upload details are invalid.");
  }
  const secureUpload = await validateSecureUpload({
    file: validation.data.file,
    allowedKinds: ["PDF", "DOCX", "TEXT", "MARKDOWN", "CSV"],
  });
  if (!secureUpload.ok) {
    fileServiceError(secureUpload.message);
  }

  const fileId = randomUUID();
  const file = validation.data.file;
  const status = statusForUploadedDocument(access.membershipRole);
  const storagePath = buildStoragePath({
    brandId: access.brandId,
    fileId,
    originalName: file.name,
  });

  await uploadPrivateFile({
    storagePath,
    file,
    mimeType: secureUpload.mimeType,
  });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("files")
    .insert({
      id: fileId,
      brand_id: access.brandId,
      storage_path: storagePath,
      original_name: file.name,
      mime_type: secureUpload.mimeType,
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
    await removePrivateFileOrQueue({
      storagePath,
      fileId,
      reason: "UPLOAD_ROLLBACK",
    });
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
  } satisfies BrandDocumentRecord;

  await processPendingStorageCleanups(undefined, 3);
  await insertFileAuditLog({
    actorUserId: profileId,
    actorRole: access.membershipRole,
    brandId: access.brandId,
    action: "file_uploaded",
    file: record,
    afterJson: {
      file: toDocumentAuditMetadata(record),
      specialist_upload_pending: status === "PENDING_OWNER_APPROVAL",
    },
  });

  return record;
}

export async function createSignedDownloadUrlForDocument({
  fileId,
  profileId,
}: {
  fileId: string;
  profileId: string;
}) {
  const access = await getDocumentAccessContextForProfile(profileId);

  if (!access) {
    fileServiceError("You do not have permission to download this document.");
  }

  const file = await getBrandDocumentById(fileId);

  if (!file || file.brandId !== access.brandId) {
    fileServiceError("Document could not be found.");
  }

  if (
    !canDownloadDocument({
      file,
      role: access.membershipRole,
      profileId,
    })
  ) {
    fileServiceError("You do not have permission to download this document.");
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
      file: toDocumentAuditMetadata(file),
      signed_url_expires_in_seconds: signedDownloadUrlTtlSeconds,
    },
  });

  return { signedUrl, file };
}

export async function reviewSpecialistDocument({
  fileId,
  profileId,
  decision,
}: {
  fileId: string;
  profileId: string;
  decision: DocumentReviewDecision;
}) {
  const access = await getDocumentAccessContextForProfile(profileId);

  if (!access) {
    fileServiceError("You do not have permission to review this document.");
  }

  const file = await getBrandDocumentById(fileId);

  if (!file || file.brandId !== access.brandId) {
    fileServiceError("Document could not be found.");
  }

  if (
    !canReviewSpecialistDocument({
      file,
      role: access.membershipRole,
    })
  ) {
    fileServiceError("You do not have permission to review this document.");
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
    fileServiceError("Document review could not be completed.");
  }

  const reviewedFile = {
    ...file,
    status: nextStatus,
  } satisfies BrandDocumentRecord;

  await insertFileAuditLog({
    actorUserId: profileId,
    actorRole: access.membershipRole,
    brandId: access.brandId,
    action: "specialist_file_approved",
    file: reviewedFile,
    beforeJson: {
      file: toDocumentAuditMetadata(file),
    },
    afterJson: {
      file: toDocumentAuditMetadata(reviewedFile),
      decision,
    },
  });

  return reviewedFile;
}
