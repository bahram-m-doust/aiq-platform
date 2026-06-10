import type { GlobalRole } from "@/features/auth/types";
import type {
  AdminModuleRole,
  CanonicalModuleTypeKey,
  ClientModuleRole,
  ModuleActionFormState,
  ModuleArtifactRecord,
  ModuleArtifactType,
  ModuleRecord,
  ModuleReviewDecision,
  ModuleReviewRecord,
  ModuleReviewType,
  ModuleStatus,
  ModuleUploadFormState,
  ModuleUploadInput,
} from "@/features/modules/types";
import {
  canonicalModuleTypeKeys,
  canonicalModuleTypes,
  moduleArtifactTypes,
  moduleReviewDecisions,
  moduleReviewTypes,
  moduleStatuses,
} from "@/features/modules/types";

export const initialModuleUploadFormState: ModuleUploadFormState = {
  status: "idle",
  message: "",
};

export const initialModuleActionFormState: ModuleActionFormState = {
  status: "idle",
  message: "",
};

export const moduleStatusLabels: Record<ModuleStatus, string> = {
  NOT_STARTED: "Not started",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  INTERNAL_REVIEW: "Internal review",
  SUPERVISOR_APPROVED: "Supervisor approved",
  CLIENT_REVIEW: "Client review",
  CLIENT_APPROVED: "Client approved",
  CLIENT_CHANGE_REQUESTED: "Client change requested",
  RAG_REVIEW_REQUIRED: "RAG review required",
  RAG_APPROVED: "RAG approved",
  RAG_SYNCED: "RAG synced",
  LOCKED: "Locked",
};

export const canonicalModuleTypeLabels: Record<CanonicalModuleTypeKey, string> =
  {
    BRAND_KNOWLEDGE: "Brand Knowledge",
    ARCHETYPE: "Archetype",
    MARKET_INTELLIGENCE: "Market Intelligence",
    CITY_EXPERIENCE_STRATEGIES: "City Experience Strategies",
    LANGUAGE_STYLE: "Language Style",
    VISUAL_SYSTEM: "Visual System",
    RESEARCHES_AND_BENCHMARKS: "Researches and Benchmarks",
  };

const maxClientCommentLength = 4000;
const docxMimeType =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

export function isModuleStatus(value: string): value is ModuleStatus {
  return moduleStatuses.includes(value as ModuleStatus);
}

export function isModuleArtifactType(
  value: string,
): value is ModuleArtifactType {
  return moduleArtifactTypes.includes(value as ModuleArtifactType);
}

export function isModuleReviewType(value: string): value is ModuleReviewType {
  return moduleReviewTypes.includes(value as ModuleReviewType);
}

export function isModuleReviewDecision(
  value: string,
): value is ModuleReviewDecision {
  return moduleReviewDecisions.includes(value as ModuleReviewDecision);
}

export function isCanonicalModuleType(value: string) {
  return (
    canonicalModuleTypes.includes(
      value as (typeof canonicalModuleTypes)[number],
    ) ||
    canonicalModuleTypeKeys.includes(
      value as (typeof canonicalModuleTypeKeys)[number],
    )
  );
}

export function moduleTypeLabel(value: string) {
  if (
    canonicalModuleTypeKeys.includes(
      value as (typeof canonicalModuleTypeKeys)[number],
    )
  ) {
    return canonicalModuleTypeLabels[value as CanonicalModuleTypeKey];
  }

  return value;
}

export function safeModuleStatus(value: string): ModuleStatus {
  return isModuleStatus(value) ? value : "NOT_STARTED";
}

export function canViewAdminModulesRole(
  role: string | null | undefined,
): role is AdminModuleRole {
  return (
    role === "PLATFORM_OWNER" ||
    role === "SUPERVISOR" ||
    role === "INTERNAL_SPECIALIST"
  );
}

export function canUploadModuleDraftRole(role: string | null | undefined) {
  return canViewAdminModulesRole(role);
}

export function canSendModuleToClientRole(role: string | null | undefined) {
  return role === "PLATFORM_OWNER" || role === "SUPERVISOR";
}

export function canClientReviewModuleRole(
  role: string | null | undefined,
): role is ClientModuleRole {
  return role === "OWNER" || role === "EXECUTIVE_MANAGER";
}

export function canInternalUserAccessModule({
  actorRole,
  profileId,
  module,
}: {
  actorRole: GlobalRole | string | null | undefined;
  profileId: string;
  module: Pick<ModuleRecord, "assignedTo">;
}) {
  if (actorRole === "PLATFORM_OWNER" || actorRole === "SUPERVISOR") {
    return true;
  }

  return actorRole === "INTERNAL_SPECIALIST" && module.assignedTo === profileId;
}

export function artifactTypeForFile(file: File): ModuleArtifactType | null {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (type === "application/pdf" && name.endsWith(".pdf")) {
    return "PDF";
  }

  if (type === docxMimeType && name.endsWith(".docx")) {
    return "DOCX";
  }

  return null;
}

export function validateModuleUploadFormData(
  formData: FormData,
): { data: ModuleUploadInput | null; error: string | null } {
  const moduleId = formString(formData, "module_id");
  const file = formData.get("file");

  if (!moduleId) {
    return { data: null, error: "Module is missing." };
  }

  if (!isUploadFile(file) || file.size <= 0) {
    return { data: null, error: "Choose a DOCX or PDF file to upload." };
  }

  const artifactType = artifactTypeForFile(file);

  if (!artifactType) {
    return { data: null, error: "Module drafts must be DOCX or PDF files." };
  }

  return {
    data: {
      moduleId,
      file,
      artifactType,
    },
    error: null,
  };
}

export function validateClientModuleCommentFormData(
  formData: FormData,
): { data: { moduleId: string; comment: string } | null; error: string | null } {
  const moduleId = formString(formData, "module_id");
  const comment = formString(formData, "comment");

  if (!moduleId) {
    return { data: null, error: "Module is missing." };
  }

  if (!comment) {
    return { data: null, error: "Enter a comment." };
  }

  if (comment.length > maxClientCommentLength) {
    return {
      data: null,
      error: `Comment must be ${maxClientCommentLength} characters or fewer.`,
    };
  }

  return { data: { moduleId, comment }, error: null };
}

export function validateClientModuleDecisionFormData({
  formData,
  requireComment,
}: {
  formData: FormData;
  requireComment: boolean;
}): { data: { moduleId: string; comment: string | null } | null; error: string | null } {
  const moduleId = formString(formData, "module_id");
  const comment = formString(formData, "comment");

  if (!moduleId) {
    return { data: null, error: "Module is missing." };
  }

  if (requireComment && !comment) {
    return { data: null, error: "Enter a comment before requesting changes." };
  }

  if (comment.length > maxClientCommentLength) {
    return {
      data: null,
      error: `Comment must be ${maxClientCommentLength} characters or fewer.`,
    };
  }

  return { data: { moduleId, comment: comment || null }, error: null };
}

export function latestArtifactIsClientReviewPdf(
  artifact: ModuleArtifactRecord | null,
) {
  return (
    artifact?.artifactType === "PDF" &&
    artifact.file?.visibility === "CLIENT_REVIEW" &&
    (artifact.file.status === "CLIENT_REVIEW" ||
      artifact.file.status === "CLIENT_APPROVED")
  );
}

export function canSendArtifactToClientReview(
  artifact: ModuleArtifactRecord | null,
) {
  return artifact?.artifactType === "PDF";
}

export function toModuleAuditMetadata(module: ModuleRecord) {
  return {
    module_id: module.id,
    brand_id: module.brandId,
    module_type: module.moduleType,
    title: module.title,
    status: module.status,
    assigned_to: module.assignedTo,
    supervisor_id: module.supervisorId,
    current_version: module.currentVersion,
  };
}

export function toArtifactAuditMetadata(artifact: ModuleArtifactRecord) {
  return {
    artifact_id: artifact.id,
    module_id: artifact.moduleId,
    artifact_type: artifact.artifactType,
    file_id: artifact.fileId,
    version: artifact.version,
    status: artifact.status,
    uploaded_by: artifact.uploadedBy,
  };
}

export function toModuleFileAuditMetadata(file: ModuleArtifactRecord["file"]) {
  if (!file) {
    return null;
  }

  return {
    file_id: file.id,
    brand_id: file.brandId,
    original_name: file.originalName,
    mime_type: file.mimeType,
    size_bytes: file.sizeBytes,
    visibility: file.visibility,
    status: file.status,
    uploaded_by: file.uploadedBy,
    storage_path: file.storagePath,
  };
}

export function toModuleReviewAuditMetadata(review: ModuleReviewRecord) {
  return {
    review_id: review.id,
    module_id: review.moduleId,
    reviewer_id: review.reviewerId,
    review_type: review.reviewType,
    decision: review.decision,
    comment_present: Boolean(review.comment),
    comment_length: review.comment?.length ?? 0,
  };
}
