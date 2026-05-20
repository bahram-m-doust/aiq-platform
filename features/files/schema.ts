import type {
  BrandFileRecord,
  BrandFileRole,
  FileStatus,
  FileUploadInput,
  FileVisibility,
} from "@/features/files/types";
import { fileStatuses, fileVisibilities } from "@/features/files/types";

export const initialFileUploadFormState = {
  status: "idle",
  message: "",
} as const;

export const fileVisibilityLabels: Record<FileVisibility, string> = {
  OWNER_ONLY: "Owner only",
  BRAND_TEAM: "Brand team",
  HELIO_INTERNAL: "Helio internal",
  CLIENT_REVIEW: "Client review",
  AGENT_VISIBLE: "Agent visible",
};

export const fileStatusLabels: Record<FileStatus, string> = {
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
] as const satisfies readonly FileVisibility[];

const specialistUploadVisibilities = [
  "BRAND_TEAM",
] as const satisfies readonly FileVisibility[];

export function isFileVisibility(value: string): value is FileVisibility {
  return fileVisibilities.includes(value as FileVisibility);
}

export function isFileStatus(value: string): value is FileStatus {
  return fileStatuses.includes(value as FileStatus);
}

export function isBrandFileRole(
  value: string | null | undefined,
): value is BrandFileRole {
  return (
    value === "OWNER" ||
    value === "EXECUTIVE_MANAGER" ||
    value === "BRAND_SPECIALIST"
  );
}

export function canUploadFileRole(role: string | null | undefined) {
  return isBrandFileRole(role);
}

export function canApproveSpecialistFileRole(
  role: string | null | undefined,
) {
  return role === "OWNER" || role === "EXECUTIVE_MANAGER";
}

export function getUploadVisibilityOptions(role: BrandFileRole) {
  return role === "BRAND_SPECIALIST"
    ? [...specialistUploadVisibilities]
    : [...ownerUploadVisibilities];
}

export function defaultUploadVisibility(role: BrandFileRole): FileVisibility {
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

export function statusForUploadedFile(role: BrandFileRole): FileStatus {
  return role === "BRAND_SPECIALIST" ? "PENDING_OWNER_APPROVAL" : "UPLOADED";
}

export function validateFileUploadFormData({
  formData,
  role,
}: {
  formData: FormData;
  role: BrandFileRole;
}): { data: FileUploadInput | null; error: string | null } {
  const file = formData.get("file");
  const rawVisibility =
    readString(formData, "visibility") || defaultUploadVisibility(role);
  const allowedVisibilities: readonly FileVisibility[] =
    getUploadVisibilityOptions(role);

  if (!isUploadFile(file) || file.size <= 0) {
    return { data: null, error: "Choose a file to upload." };
  }

  if (!isFileVisibility(rawVisibility)) {
    return { data: null, error: "Choose a valid file visibility." };
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

export function canListFile({
  file,
  role,
  profileId,
}: {
  file: BrandFileRecord;
  role: BrandFileRole;
  profileId: string;
}) {
  if (file.visibility === "HELIO_INTERNAL") {
    return false;
  }

  if (file.visibility === "OWNER_ONLY") {
    return canApproveSpecialistFileRole(role);
  }

  if (file.status === "PENDING_OWNER_APPROVAL") {
    return canApproveSpecialistFileRole(role) || file.uploadedBy === profileId;
  }

  if (file.status === "OWNER_REJECTED" || file.status === "ARCHIVED") {
    return canApproveSpecialistFileRole(role) || file.uploadedBy === profileId;
  }

  if (file.visibility === "AGENT_VISIBLE") {
    return file.status === "RAG_APPROVED" && canApproveSpecialistFileRole(role);
  }

  return file.visibility === "BRAND_TEAM" || file.visibility === "CLIENT_REVIEW";
}

export function canDownloadFile({
  file,
  role,
  profileId,
}: {
  file: BrandFileRecord;
  role: BrandFileRole;
  profileId: string;
}) {
  if (file.status === "OWNER_REJECTED" || file.status === "ARCHIVED") {
    return false;
  }

  if (file.status === "PENDING_OWNER_APPROVAL") {
    return canApproveSpecialistFileRole(role) || file.uploadedBy === profileId;
  }

  if (file.visibility === "OWNER_ONLY") {
    return canApproveSpecialistFileRole(role);
  }

  if (file.visibility === "HELIO_INTERNAL") {
    return false;
  }

  if (file.visibility === "AGENT_VISIBLE") {
    return file.status === "RAG_APPROVED" && canApproveSpecialistFileRole(role);
  }

  return file.visibility === "BRAND_TEAM" || file.visibility === "CLIENT_REVIEW";
}

export function canReviewSpecialistFile({
  file,
  role,
}: {
  file: BrandFileRecord;
  role: BrandFileRole;
}) {
  return (
    canApproveSpecialistFileRole(role) &&
    file.status === "PENDING_OWNER_APPROVAL"
  );
}

export function toFileAuditMetadata(file: BrandFileRecord) {
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
