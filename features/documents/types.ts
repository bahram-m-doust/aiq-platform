import type { PaginationState } from "@/lib/pagination";

export const documentVisibilities = [
  "OWNER_ONLY",
  "BRAND_TEAM",
  "HELIO_INTERNAL",
  "CLIENT_REVIEW",
  "AGENT_VISIBLE",
] as const;

export type DocumentVisibility = (typeof documentVisibilities)[number];

export const documentStatuses = [
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

export type DocumentStatus = (typeof documentStatuses)[number];

export type BrandDocumentRole =
  | "OWNER"
  | "EXECUTIVE_MANAGER"
  | "BRAND_SPECIALIST";

export type DocumentAccessContext = {
  brandId: string;
  brandName: string;
  membershipRole: BrandDocumentRole;
  planName: string | null;
};

export type BrandDocumentRecord = {
  id: string;
  brandId: string;
  storagePath: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  visibility: DocumentVisibility;
  status: DocumentStatus;
  uploadedBy: string | null;
  uploadedByEmail: string | null;
  createdAt: string | null;
  approvedAt: string | null;
};

export type BrandDocumentsWorkspace = {
  access: DocumentAccessContext;
  files: BrandDocumentRecord[];
  pagination: PaginationState;
};

export type DocumentUploadInput = {
  file: File;
  visibility: DocumentVisibility;
};

export type DocumentUploadFormState =
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

export type DocumentReviewDecision = "APPROVE" | "REJECT";
