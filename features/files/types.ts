import type { PaginationState } from "@/lib/pagination";

export const fileVisibilities = [
  "OWNER_ONLY",
  "BRAND_TEAM",
  "HELIO_INTERNAL",
  "CLIENT_REVIEW",
  "AGENT_VISIBLE",
] as const;

export type FileVisibility = (typeof fileVisibilities)[number];

export const fileStatuses = [
  "UPLOADED",
  "PENDING_OWNER_APPROVAL",
  "OWNER_APPROVED",
  "OWNER_REJECTED",
  "INTERNAL_DRAFT",
  "SUPERVISOR_APPROVED",
  "CLIENT_REVIEW",
  "CLIENT_APPROVED",
  "RAG_APPROVED",
  "ARCHIVED",
] as const;

export type FileStatus = (typeof fileStatuses)[number];

export type BrandFileRole =
  | "OWNER"
  | "EXECUTIVE_MANAGER"
  | "BRAND_SPECIALIST";

export type FileAccessContext = {
  brandId: string;
  brandName: string;
  membershipRole: BrandFileRole;
  planName: string | null;
};

export type BrandFileRecord = {
  id: string;
  brandId: string;
  storagePath: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  visibility: FileVisibility;
  status: FileStatus;
  uploadedBy: string | null;
  uploadedByEmail: string | null;
  createdAt: string | null;
};

export type BrandFilesWorkspace = {
  access: FileAccessContext;
  files: BrandFileRecord[];
  pagination: PaginationState;
};

export type FileUploadInput = {
  file: File;
  visibility: FileVisibility;
};

export type FileUploadFormState =
  | {
      status: "idle";
      message: string;
    }
  | {
      status: "error";
      message: string;
    }
  | {
      status: "success";
      message: string;
      fileId: string;
    };

export type FileReviewDecision = "APPROVE" | "REJECT";
