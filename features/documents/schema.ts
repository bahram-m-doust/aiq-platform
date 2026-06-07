import type {
  BrandDocumentRecord,
  BrandDocumentRole,
  DocumentStatus,
  DocumentUploadInput,
  DocumentVisibility,
} from "@/features/documents/types";
import { documentStatuses, documentVisibilities } from "@/features/documents/types";

export const initialDocumentUploadFormState = {
  status: "idle",
  message: "",
} as const;

export const documentVisibilityLabels: Record<DocumentVisibility, string> = {
  OWNER_ONLY: "Owner only",
  BRAND_TEAM: "Brand team",
  HELIO_INTERNAL: "Helio internal",
  CLIENT_REVIEW: "Client review",
  AGENT_VISIBLE: "Agent visible",
};

export const documentStatusLabels: Record<DocumentStatus, string> = {
  UPLOADED: "Uploaded",
  PENDING_OWNER_APPROVAL: "Pending owner approval",
  OWNER_APPROVED: "Owner approved",
  OWNER_REJECTED: "Owner rejected",
  INTERNAL_DRAFT: "Internal draft",
  SUPERVISOR_APPROVED: "Supervisor approved",
  CLIENT_REVIEW: "Client review",
  CLIENT_APPROVED: "Client approved",
  RAG_APPROVED: "RAG approved",
  ARCHIVED: "Archived",
};

const ownerUploadVisibilities = [
  "OWNER_ONLY",
  "BRAND_TEAM",
  "CLIENT_REVIEW",
] as const satisfies readonly DocumentVisibility[];

const specialistUploadVisibilities = [
  "BRAND_TEAM",
] as const satisfies readonly DocumentVisibility[];

export function isDocumentVisibility(value: string): value is DocumentVisibility {
  return documentVisibilities.includes(value as DocumentVisibility);
}

export function isDocumentStatus(value: string): value is DocumentStatus {
  return documentStatuses.includes(value as DocumentStatus);
}

export function isBrandDocumentRole(
  value: string | null | undefined,
): value is BrandDocumentRole {
  return (
    value === "OWNER" ||
    value === "EXECUTIVE_MANAGER" ||
    value === "BRAND_SPECIALIST"
  );
}

export function canUploadDocumentRole(role: string | null | undefined) {
  return isBrandDocumentRole(role);
}

export function canApproveSpecialistDocumentRole(
  role: string | null | undefined,
) {
  return role === "OWNER" || role === "EXECUTIVE_MANAGER";
}

export function getUploadVisibilityOptions(role: BrandDocumentRole) {
  return role === "BRAND_SPECIALIST"
    ? [...specialistUploadVisibilities]
    : [...ownerUploadVisibilities];
}

export function defaultUploadVisibility(role: BrandDocumentRole): DocumentVisibility {
  return role === "BRAND_SPECIALIST" ? "BRAND_TEAM" : "OWNER_ONLY";
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

export function sanitizeFileName(fileName: string) {
  const sanitized = fileName
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 120);

  return sanitized || "file";
}

export function buildStoragePath({
  brandId,
  fileId,
  originalName,
}: {
  brandId: string;
  fileId: string;
  originalName: string;
}) {
  return `${brandId}/${fileId}/${sanitizeFileName(originalName)}`;
}

export function statusForUploadedDocument(role: BrandDocumentRole): DocumentStatus {
  return role === "BRAND_SPECIALIST" ? "PENDING_OWNER_APPROVAL" : "UPLOADED";
}

export function validateDocumentUploadFormData({
  formData,
  role,
}: {
  formData: FormData;
  role: BrandDocumentRole;
}): { data: DocumentUploadInput | null; error: string | null } {
  const file = formData.get("file");
  const rawVisibility =
    readString(formData, "visibility") || defaultUploadVisibility(role);
  const allowedVisibilities: readonly DocumentVisibility[] =
    getUploadVisibilityOptions(role);

  if (!isUploadFile(file) || file.size <= 0) {
    return { data: null, error: "Choose a document to upload." };
  }

  if (!isDocumentVisibility(rawVisibility)) {
    return { data: null, error: "Choose a valid document visibility." };
  }

  if (!allowedVisibilities.includes(rawVisibility)) {
    return {
      data: null,
      error: "This visibility is not available for this upload.",
    };
  }

  return {
    data: {
      file,
      visibility: rawVisibility,
    },
    error: null,
  };
}

export function canListDocument({
  file,
  role,
  profileId,
}: {
  file: BrandDocumentRecord;
  role: BrandDocumentRole;
  profileId: string;
}) {
  if (file.visibility === "HELIO_INTERNAL") {
    return false;
  }

  if (file.visibility === "OWNER_ONLY") {
    return canApproveSpecialistDocumentRole(role);
  }

  if (file.status === "PENDING_OWNER_APPROVAL") {
    return canApproveSpecialistDocumentRole(role) || file.uploadedBy === profileId;
  }

  if (file.status === "OWNER_REJECTED" || file.status === "ARCHIVED") {
    return canApproveSpecialistDocumentRole(role) || file.uploadedBy === profileId;
  }

  if (file.visibility === "AGENT_VISIBLE") {
    return file.status === "RAG_APPROVED" && canApproveSpecialistDocumentRole(role);
  }

  return file.visibility === "BRAND_TEAM" || file.visibility === "CLIENT_REVIEW";
}

export function canDownloadDocument({
  file,
  role,
  profileId,
}: {
  file: BrandDocumentRecord;
  role: BrandDocumentRole;
  profileId: string;
}) {
  if (file.status === "OWNER_REJECTED" || file.status === "ARCHIVED") {
    return false;
  }

  if (file.status === "PENDING_OWNER_APPROVAL") {
    return canApproveSpecialistDocumentRole(role) || file.uploadedBy === profileId;
  }

  if (file.visibility === "OWNER_ONLY") {
    return canApproveSpecialistDocumentRole(role);
  }

  if (file.visibility === "HELIO_INTERNAL") {
    return false;
  }

  if (file.visibility === "AGENT_VISIBLE") {
    return file.status === "RAG_APPROVED" && canApproveSpecialistDocumentRole(role);
  }

  return file.visibility === "BRAND_TEAM" || file.visibility === "CLIENT_REVIEW";
}

export function canReviewSpecialistDocument({
  file,
  role,
}: {
  file: BrandDocumentRecord;
  role: BrandDocumentRole;
}) {
  return (
    canApproveSpecialistDocumentRole(role) &&
    file.status === "PENDING_OWNER_APPROVAL"
  );
}

export function toDocumentAuditMetadata(file: BrandDocumentRecord) {
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
