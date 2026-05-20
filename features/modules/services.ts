import "server-only";

import { randomUUID } from "node:crypto";

import { buildStoragePath } from "@/features/files/schema";
import {
  createPrivateFileSignedDownloadUrl,
  removePrivateFile,
  signedDownloadUrlTtlSeconds,
  uploadPrivateFile,
} from "@/features/files/storage";
import {
  canInternalUserAccessModule,
  canSendArtifactToClientReview,
  canSendModuleToClientRole,
  canUploadModuleDraftRole,
  latestArtifactIsClientReviewPdf,
  toArtifactAuditMetadata,
  toModuleAuditMetadata,
  toModuleFileAuditMetadata,
  toModuleReviewAuditMetadata,
  validateModuleUploadFormData,
} from "@/features/modules/schema";
import {
  getClientModuleDetail,
  getLatestModuleArtifact,
  getModuleById,
} from "@/features/modules/queries";
import type {
  ClientModuleReviewPageData,
  ModuleArtifactRecord,
  ModuleRecord,
  ModuleUploadInput,
} from "@/features/modules/types";
import { insertModuleAuditLog } from "@/features/modules/service-audit";
import {
  assertModuleTypeIsCanonical,
  requireAdminModuleDetail,
  requireClientModuleDetail,
} from "@/features/modules/service-guards";
import {
  artifactColumns,
  type ArtifactRow,
  reviewColumns,
  type ReviewRow,
  toTemporaryArtifactRecord,
  toTemporaryReviewRecord,
} from "@/features/modules/service-records";
import { moduleServiceError } from "@/features/modules/service-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserProfile } from "@/features/auth/types";

export { assertAdminModuleRole } from "@/features/modules/service-guards";
export { isModuleServiceError } from "@/features/modules/service-errors";

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
  const fileInsert = {
    id: fileId,
    brand_id: brandModule.brandId,
    storage_path: storagePath,
    original_name: input.file.name,
    mime_type: input.file.type || null,
    size_bytes: input.file.size,
    visibility: "HELIO_INTERNAL",
    status: "INTERNAL_DRAFT",
    uploaded_by: profile.id,
  };

  const { error: fileError } = await admin.from("files").insert(fileInsert);

  if (fileError) {
    await removePrivateFile(storagePath);
    throw fileError;
  }

  const { data: artifactData, error: artifactError } = await admin
    .from("module_artifacts")
    .insert({
      module_id: brandModule.id,
      artifact_type: input.artifactType,
      file_id: fileId,
      version: nextVersion,
      status: "INTERNAL_DRAFT",
      uploaded_by: profile.id,
    })
    .select(artifactColumns)
    .single();

  if (artifactError) {
    await removePrivateFile(storagePath);
    throw artifactError;
  }

  const { error: moduleError } = await admin
    .from("brand_modules")
    .update({
      status: "INTERNAL_REVIEW",
      current_version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", brandModule.id)
    .eq("brand_id", brandModule.brandId);

  if (moduleError) {
    throw moduleError;
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
    row: artifactData as unknown as ArtifactRow,
    brandModule,
    file: fileRecord,
  });
  const updatedModule: ModuleRecord = {
    ...brandModule,
    status: "INTERNAL_REVIEW",
    currentVersion: nextVersion,
  };

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
  const { error: moduleError } = await admin
    .from("brand_modules")
    .update({
      status: "CLIENT_REVIEW",
      updated_at: nowIso,
    })
    .eq("id", detail.module.id)
    .eq("brand_id", detail.module.brandId);

  if (moduleError) {
    throw moduleError;
  }

  const [artifactUpdate, fileUpdate] = await Promise.all([
    admin
      .from("module_artifacts")
      .update({ status: "CLIENT_REVIEW" })
      .eq("id", latestArtifact.id)
      .eq("module_id", detail.module.id),
    admin
      .from("files")
      .update({
        visibility: "CLIENT_REVIEW",
        status: "CLIENT_REVIEW",
      })
      .eq("id", latestArtifact.file.id)
      .eq("brand_id", detail.module.brandId),
  ]);

  if (artifactUpdate.error) {
    throw artifactUpdate.error;
  }

  if (fileUpdate.error) {
    throw fileUpdate.error;
  }

  const { data: reviewData, error: reviewError } = await admin
    .from("module_reviews")
    .insert({
      module_id: detail.module.id,
      reviewer_id: profile.id,
      review_type: "SUPERVISOR",
      decision: "APPROVED_FOR_CLIENT_REVIEW",
      comment: null,
    })
    .select(reviewColumns)
    .single();

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
  const review = toTemporaryReviewRecord(reviewData as unknown as ReviewRow);

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
  const reviewDecision =
    decision === "APPROVE" ? "APPROVED" : "CHANGE_REQUESTED";
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { error: moduleError } = await admin
    .from("brand_modules")
    .update({
      status: nextModuleStatus,
      updated_at: nowIso,
    })
    .eq("id", detail.module.id)
    .eq("brand_id", detail.module.brandId);

  if (moduleError) {
    throw moduleError;
  }

  let updatedArtifact = artifact;

  if (decision === "APPROVE") {
    const [artifactUpdate, fileUpdate] = await Promise.all([
      admin
        .from("module_artifacts")
        .update({ status: "CLIENT_APPROVED" })
        .eq("id", artifact.id)
        .eq("module_id", detail.module.id),
      admin
        .from("files")
        .update({ status: "CLIENT_APPROVED" })
        .eq("id", artifact.file.id)
        .eq("brand_id", detail.module.brandId),
    ]);

    if (artifactUpdate.error) {
      throw artifactUpdate.error;
    }

    if (fileUpdate.error) {
      throw fileUpdate.error;
    }

    updatedArtifact = {
      ...artifact,
      status: "CLIENT_APPROVED",
      file: {
        ...artifact.file,
        status: "CLIENT_APPROVED",
      },
    };
  }

  const { data: reviewData, error: reviewError } = await admin
    .from("module_reviews")
    .insert({
      module_id: detail.module.id,
      reviewer_id: profile.id,
      review_type: "CLIENT",
      decision: reviewDecision,
      comment,
    })
    .select(reviewColumns)
    .single();

  if (reviewError) {
    throw reviewError;
  }

  const review = toTemporaryReviewRecord(reviewData as unknown as ReviewRow);
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

export async function ensureModuleExistsForService(moduleId: string) {
  const brandModule = await getModuleById(moduleId);

  if (!brandModule) {
    moduleServiceError("Module could not be found.");
  }

  return brandModule;
}
