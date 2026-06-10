import "server-only";

import { randomUUID } from "node:crypto";

import type { UserProfile } from "@/features/auth/types";
import { buildStoragePath } from "@/features/documents/schema";
import {
  createPrivateFileSignedDownloadUrl,
  signedDownloadUrlTtlSeconds,
  uploadPrivateFile,
} from "@/features/documents/storage";
import {
  processPendingStorageCleanups,
  removePrivateFileOrQueue,
} from "@/features/documents/storage-cleanup";
import {
  getAdminModuleDetail,
  getClientModuleDetail,
  getLatestModuleArtifact,
  reviewColumns,
  type ArtifactRow,
  type ReviewRow,
} from "@/features/modules/queries";
import {
  canInternalUserAccessModule,
  canSendArtifactToClientReview,
  canSendModuleToClientRole,
  canUploadModuleDraftRole,
  canViewAdminModulesRole,
  isCanonicalModuleType,
  latestArtifactIsClientReviewPdf,
  toArtifactAuditMetadata,
  toModuleAuditMetadata,
  toModuleFileAuditMetadata,
  toModuleReviewAuditMetadata,
  validateModuleUploadFormData,
} from "@/features/modules/schema";
import type {
  ClientModuleReviewPageData,
  ModuleArtifactRecord,
  ModuleRecord,
  ModuleReviewRecord,
  ModuleUploadInput,
} from "@/features/modules/types";
import { logAudit } from "@/lib/audit/logAudit";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateSecureUpload } from "@/lib/security/file-upload";

const CODE = "module_service";

function moduleServiceError(message: string): never {
  throw new DomainError(CODE, message);
}

export function isModuleServiceError(error: unknown): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}

type ModuleAuditAction =
  | "module_uploaded"
  | "module_sent_to_client"
  | "module_client_approved"
  | "module_change_requested"
  | "file_downloaded";

async function insertModuleAuditLog({
  actorUserId,
  actorRole,
  brandId,
  action,
  entityType,
  entityId,
  beforeJson = null,
  afterJson,
}: {
  actorUserId: string;
  actorRole: string | null;
  brandId: string;
  action: ModuleAuditAction;
  entityType: "module" | "file";
  entityId: string;
  beforeJson?: Record<string, unknown> | null;
  afterJson: Record<string, unknown>;
}) {
  await logAudit({
    actorUserId,
    actorRole,
    brandId,
    action,
    entityType,
    entityId,
    before: beforeJson,
    after: afterJson,
  });
}

async function requireAdminModuleDetail({
  moduleId,
  profile,
}: {
  moduleId: string;
  profile: UserProfile;
}) {
  const detail = await getAdminModuleDetail({ moduleId, profile });

  if (!detail) {
    moduleServiceError("Module could not be found.");
  }

  return detail;
}

async function requireClientModuleDetail({
  moduleId,
  profileId,
}: {
  moduleId: string;
  profileId: string;
}) {
  const detail = await getClientModuleDetail({ moduleId, profileId });

  if (!detail) {
    moduleServiceError("Module could not be found.");
  }

  return detail;
}

function assertModuleTypeIsCanonical(brandModule: ModuleRecord) {
  if (!isCanonicalModuleType(brandModule.moduleType)) {
    moduleServiceError("This module type is not configured for the MVP workflow.");
  }
}

export function assertAdminModuleRole(role: string | null | undefined) {
  if (!canViewAdminModulesRole(role)) {
    moduleServiceError("You do not have permission to manage modules.");
  }
}

function toTemporaryArtifactRecord({
  row,
  brandModule,
  file,
}: {
  row: ArtifactRow;
  brandModule: ModuleRecord;
  file: ModuleArtifactRecord["file"];
}): ModuleArtifactRecord {
  return {
    id: row.id,
    moduleId: row.module_id,
    artifactType: row.artifact_type === "DOCX" ? "DOCX" : "PDF",
    fileId: row.file_id,
    version: row.version ?? 1,
    status: row.status ?? "INTERNAL_DRAFT",
    uploadedBy: row.uploaded_by,
    uploadedByEmail: null,
    createdAt: row.created_at,
    file: file
      ? {
          ...file,
          brandId: brandModule.brandId,
        }
      : null,
  };
}

function toTemporaryReviewRecord(row: ReviewRow): ModuleReviewRecord {
  return {
    id: row.id,
    moduleId: row.module_id,
    reviewerId: row.reviewer_id,
    reviewerEmail: null,
    reviewType: row.review_type === "SUPERVISOR" ? "SUPERVISOR" : "CLIENT",
    decision:
      row.decision === "APPROVED_FOR_CLIENT_REVIEW" ||
      row.decision === "APPROVED" ||
      row.decision === "CHANGE_REQUESTED"
        ? row.decision
        : "COMMENT",
    comment: row.comment,
    createdAt: row.created_at,
  };
}

async function uploadModuleArtifact({
  input,
  profile,
  brandModule,
  nextVersion,
}: {
  input: ModuleUploadInput;
  profile: UserProfile;
  brandModule: ModuleRecord;
  nextVersion: number;
}) {
  const fileId = randomUUID();
  const storagePath = buildStoragePath({
    brandId: brandModule.brandId,
    fileId,
    originalName: input.file.name,
  });

  await uploadPrivateFile({
    storagePath,
    file: input.file,
    mimeType: input.file.type || null,
  });

  const admin = createAdminClient();
  const { data: artifactData, error: artifactError } = await admin
    .rpc("create_module_artifact_with_file", {
      p_module_id: brandModule.id,
      p_brand_id: brandModule.brandId,
      p_uploaded_by: profile.id,
      p_file_id: fileId,
      p_storage_path: storagePath,
      p_original_name: input.file.name,
      p_mime_type: input.file.type || null,
      p_size_bytes: input.file.size,
      p_artifact_type: input.artifactType,
      p_next_version: nextVersion,
    });

  if (artifactError) {
    await removePrivateFileOrQueue({
      storagePath,
      fileId,
      reason: "MODULE_UPLOAD_ROLLBACK",
    });
    throw artifactError;
  }

  const artifactRow = Array.isArray(artifactData)
    ? artifactData[0]
    : artifactData;
  if (!artifactRow) {
    await removePrivateFileOrQueue({
      storagePath,
      fileId,
      reason: "MODULE_UPLOAD_ROLLBACK",
    });
    throw new Error("Module artifact transaction returned no artifact.");
  }

  const fileRecord = {
    id: fileId,
    brandId: brandModule.brandId,
    storagePath,
    originalName: input.file.name,
    mimeType: input.file.type || null,
    sizeBytes: input.file.size,
    visibility: "HELIO_INTERNAL" as const,
    status: "INTERNAL_DRAFT" as const,
    uploadedBy: profile.id,
    uploadedByEmail: profile.email,
    createdAt: new Date().toISOString(),
  };
  const artifact = toTemporaryArtifactRecord({
    row: artifactRow as unknown as ArtifactRow,
    brandModule,
    file: fileRecord,
  });
  const updatedModule: ModuleRecord = {
    ...brandModule,
    status: "INTERNAL_REVIEW",
    currentVersion: nextVersion,
  };

  await processPendingStorageCleanups(undefined, 3);
  await insertModuleAuditLog({
    actorUserId: profile.id,
    actorRole: profile.global_role,
    brandId: brandModule.brandId,
    action: "module_uploaded",
    entityType: "module",
    entityId: brandModule.id,
    beforeJson: {
      module: toModuleAuditMetadata(brandModule),
    },
    afterJson: {
      module: toModuleAuditMetadata(updatedModule),
      artifact: toArtifactAuditMetadata(artifact),
      file: toModuleFileAuditMetadata(artifact.file),
    },
  });

  return {
    artifact,
    module: updatedModule,
  };
}

export async function uploadModuleArtifactFromFormData({
  formData,
  profile,
}: {
  formData: FormData;
  profile: UserProfile;
}) {
  if (!canUploadModuleDraftRole(profile.global_role)) {
    moduleServiceError("You do not have permission to upload module drafts.");
  }

  const validation = validateModuleUploadFormData(formData);

  if (validation.error || !validation.data) {
    moduleServiceError(validation.error ?? "Module upload details are invalid.");
  }
  const secureUpload = await validateSecureUpload({
    file: validation.data.file,
    allowedKinds: ["PDF", "DOCX"],
  });
  if (!secureUpload.ok) {
    moduleServiceError(secureUpload.message);
  }

  const detail = await requireAdminModuleDetail({
    moduleId: validation.data.moduleId,
    profile,
  });

  if (
    !canInternalUserAccessModule({
      actorRole: profile.global_role,
      profileId: profile.id,
      module: detail.module,
    })
  ) {
    moduleServiceError("You do not have permission to upload this module.");
  }

  assertModuleTypeIsCanonical(detail.module);

  const latestArtifact = getLatestModuleArtifact(detail.artifacts);
  const nextVersion = (latestArtifact?.version ?? 0) + 1;

  return uploadModuleArtifact({
    input: validation.data,
    profile,
    brandModule: detail.module,
    nextVersion,
  });
}

export async function sendModuleToClientReview({
  moduleId,
  profile,
}: {
  moduleId: string;
  profile: UserProfile;
}) {
  if (!canSendModuleToClientRole(profile.global_role)) {
    moduleServiceError("You do not have permission to send modules to clients.");
  }

  const detail = await requireAdminModuleDetail({ moduleId, profile });
  const latestArtifact = detail.latestArtifact;

  assertModuleTypeIsCanonical(detail.module);

  if (!canSendArtifactToClientReview(latestArtifact)) {
    moduleServiceError("A PDF artifact is required before client review.");
  }

  if (!latestArtifact?.file) {
    moduleServiceError("The latest module artifact file could not be found.");
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data: reviewData, error: reviewError } = await admin
    .rpc("transition_module_review", {
      p_action: "SEND_TO_CLIENT",
      p_module_id: detail.module.id,
      p_brand_id: detail.module.brandId,
      p_artifact_id: latestArtifact.id,
      p_file_id: latestArtifact.file.id,
      p_reviewer_id: profile.id,
      p_comment: null,
    });

  if (reviewError) {
    throw reviewError;
  }

  const updatedModule: ModuleRecord = {
    ...detail.module,
    status: "CLIENT_REVIEW",
    updatedAt: nowIso,
  };
  const updatedArtifact: ModuleArtifactRecord = {
    ...latestArtifact,
    status: "CLIENT_REVIEW",
    file: {
      ...latestArtifact.file,
      visibility: "CLIENT_REVIEW",
      status: "CLIENT_REVIEW",
    },
  };
  const reviewRow = Array.isArray(reviewData) ? reviewData[0] : reviewData;
  if (!reviewRow) {
    throw new Error("Module review transaction returned no review.");
  }
  const review = toTemporaryReviewRecord(reviewRow as unknown as ReviewRow);

  await insertModuleAuditLog({
    actorUserId: profile.id,
    actorRole: profile.global_role,
    brandId: detail.module.brandId,
    action: "module_sent_to_client",
    entityType: "module",
    entityId: detail.module.id,
    beforeJson: {
      module: toModuleAuditMetadata(detail.module),
      artifact: toArtifactAuditMetadata(latestArtifact),
      file: toModuleFileAuditMetadata(latestArtifact.file),
    },
    afterJson: {
      module: toModuleAuditMetadata(updatedModule),
      artifact: toArtifactAuditMetadata(updatedArtifact),
      file: toModuleFileAuditMetadata(updatedArtifact.file),
      review: toModuleReviewAuditMetadata(review),
    },
  });

  return {
    module: updatedModule,
    artifact: updatedArtifact,
    review,
  };
}

export async function getClientModuleReviewPageData({
  moduleId,
  profile,
}: {
  moduleId: string;
  profile: UserProfile;
}): Promise<ClientModuleReviewPageData | null> {
  const detail = await getClientModuleDetail({
    moduleId,
    profileId: profile.id,
  });

  if (!detail) {
    return null;
  }

  const artifact = detail.latestClientArtifact;

  if (!latestArtifactIsClientReviewPdf(artifact) || !artifact?.file) {
    return {
      ...detail,
      signedUrl: null,
      signedUrlExpiresInSeconds: null,
    };
  }

  const signedUrl = await createPrivateFileSignedDownloadUrl({
    storagePath: artifact.file.storagePath,
    downloadName: artifact.file.originalName,
  });

  await insertModuleAuditLog({
    actorUserId: profile.id,
    actorRole: detail.access.membershipRole,
    brandId: detail.module.brandId,
    action: "file_downloaded",
    entityType: "file",
    entityId: artifact.file.id,
    afterJson: {
      purpose: "module_pdf_preview",
      module: toModuleAuditMetadata(detail.module),
      artifact: toArtifactAuditMetadata(artifact),
      file: toModuleFileAuditMetadata(artifact.file),
      signed_url_expires_in_seconds: signedDownloadUrlTtlSeconds,
    },
  });

  return {
    ...detail,
    signedUrl,
    signedUrlExpiresInSeconds: signedDownloadUrlTtlSeconds,
  };
}

export async function addClientModuleComment({
  moduleId,
  profile,
  comment,
}: {
  moduleId: string;
  profile: UserProfile;
  comment: string;
}) {
  const detail = await requireClientModuleDetail({
    moduleId,
    profileId: profile.id,
  });

  if (detail.module.status !== "CLIENT_REVIEW") {
    moduleServiceError("Client comments are available only during review.");
  }

  if (!latestArtifactIsClientReviewPdf(detail.latestClientArtifact)) {
    moduleServiceError("A client-review PDF is required before commenting.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("module_reviews")
    .insert({
      module_id: detail.module.id,
      reviewer_id: profile.id,
      review_type: "CLIENT",
      decision: "COMMENT",
      comment,
    })
    .select(reviewColumns)
    .single();

  if (error) {
    throw error;
  }

  return toTemporaryReviewRecord(data as unknown as ReviewRow);
}

export async function submitClientModuleDecision({
  moduleId,
  profile,
  decision,
  comment,
}: {
  moduleId: string;
  profile: UserProfile;
  decision: "APPROVE" | "REQUEST_CHANGE";
  comment: string | null;
}) {
  const detail = await requireClientModuleDetail({
    moduleId,
    profileId: profile.id,
  });
  const artifact = detail.latestClientArtifact;

  if (detail.module.status !== "CLIENT_REVIEW") {
    moduleServiceError("Module decisions are available only during client review.");
  }

  if (!latestArtifactIsClientReviewPdf(artifact) || !artifact?.file) {
    moduleServiceError("A client-review PDF is required before a decision.");
  }

  if (decision === "REQUEST_CHANGE" && !comment) {
    moduleServiceError("Enter a comment before requesting changes.");
  }

  const nextModuleStatus =
    decision === "APPROVE" ? "CLIENT_APPROVED" : "CLIENT_CHANGE_REQUESTED";
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const updatedArtifact: ModuleArtifactRecord =
    decision === "APPROVE"
      ? {
      ...artifact,
      status: "CLIENT_APPROVED",
      file: {
        ...artifact.file,
        status: "CLIENT_APPROVED",
      },
        }
      : artifact;

  const { data: reviewData, error: reviewError } = await admin
    .rpc("transition_module_review", {
      p_action:
        decision === "APPROVE"
          ? "CLIENT_APPROVE"
          : "CLIENT_REQUEST_CHANGE",
      p_module_id: detail.module.id,
      p_brand_id: detail.module.brandId,
      p_artifact_id: artifact.id,
      p_file_id: artifact.file.id,
      p_reviewer_id: profile.id,
      p_comment: comment,
    });

  if (reviewError) {
    throw reviewError;
  }

  const reviewRow = Array.isArray(reviewData) ? reviewData[0] : reviewData;
  if (!reviewRow) {
    throw new Error("Module decision transaction returned no review.");
  }
  const review = toTemporaryReviewRecord(reviewRow as unknown as ReviewRow);
  const updatedModule: ModuleRecord = {
    ...detail.module,
    status: nextModuleStatus,
    updatedAt: nowIso,
  };

  await insertModuleAuditLog({
    actorUserId: profile.id,
    actorRole: detail.access.membershipRole,
    brandId: detail.module.brandId,
    action:
      decision === "APPROVE"
        ? "module_client_approved"
        : "module_change_requested",
    entityType: "module",
    entityId: detail.module.id,
    beforeJson: {
      module: toModuleAuditMetadata(detail.module),
      artifact: toArtifactAuditMetadata(artifact),
      file: toModuleFileAuditMetadata(artifact.file),
    },
    afterJson: {
      module: toModuleAuditMetadata(updatedModule),
      artifact: toArtifactAuditMetadata(updatedArtifact),
      file: toModuleFileAuditMetadata(updatedArtifact.file),
      review: toModuleReviewAuditMetadata(review),
    },
  });

  return {
    module: updatedModule,
    artifact: updatedArtifact,
    review,
  };
}
