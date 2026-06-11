import type { DocumentStatus, DocumentVisibility } from "@/features/documents/types";
import type { PaginationState } from "@/lib/pagination";

export const canonicalModuleTypes = [
  "Brand Knowledge",
  "Archetype",
  "Market Intelligence",
  "City Experience Strategies",
  "Language Style",
  "Visual System",
  "Researches and Benchmarks",
] as const;

export const canonicalModuleTypeKeys = [
  "BRAND_KNOWLEDGE",
  "ARCHETYPE",
  "MARKET_INTELLIGENCE",
  "CITY_EXPERIENCE_STRATEGIES",
  "LANGUAGE_STYLE",
  "VISUAL_SYSTEM",
  "RESEARCHES_AND_BENCHMARKS",
] as const;

export type CanonicalModuleType = (typeof canonicalModuleTypes)[number];
export type CanonicalModuleTypeKey = (typeof canonicalModuleTypeKeys)[number];

export const moduleStatuses = [
  "NOT_STARTED",
  "ASSIGNED",
  "IN_PROGRESS",
  "INTERNAL_REVIEW",
  "SUPERVISOR_APPROVED",
  "CLIENT_REVIEW",
  "CLIENT_APPROVED",
  "CLIENT_CHANGE_REQUESTED",
  "RAG_REVIEW_REQUIRED",
  "RAG_APPROVED",
  "RAG_SYNCED",
  "LOCKED",
] as const;

export type ModuleStatus = (typeof moduleStatuses)[number];

export const moduleArtifactTypes = ["DOCX", "PDF"] as const;
export type ModuleArtifactType = (typeof moduleArtifactTypes)[number];

export const moduleReviewTypes = ["SUPERVISOR", "CLIENT"] as const;
export type ModuleReviewType = (typeof moduleReviewTypes)[number];

export const moduleReviewDecisions = [
  "APPROVED_FOR_CLIENT_REVIEW",
  "COMMENT",
  "APPROVED",
  "CHANGE_REQUESTED",
] as const;

export type ModuleReviewDecision = (typeof moduleReviewDecisions)[number];

export type AdminModuleRole =
  | "PLATFORM_OWNER"
  | "SUPERVISOR"
  | "INTERNAL_SPECIALIST";

export type ClientModuleRole = "OWNER" | "EXECUTIVE_MANAGER";

export type ModuleRecord = {
  id: string;
  brandId: string;
  brandName: string;
  moduleType: string;
  moduleTypeLabel: string;
  title: string;
  status: ModuleStatus;
  assignedTo: string | null;
  assignedToEmail: string | null;
  supervisorId: string | null;
  supervisorEmail: string | null;
  currentVersion: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ModuleFileRecord = {
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
};

export type ModuleArtifactRecord = {
  id: string;
  moduleId: string;
  artifactType: ModuleArtifactType;
  fileId: string | null;
  version: number;
  status: string;
  uploadedBy: string | null;
  uploadedByEmail: string | null;
  createdAt: string | null;
  file: ModuleFileRecord | null;
};

export type ModuleReviewRecord = {
  id: string;
  moduleId: string;
  reviewerId: string;
  reviewerEmail: string | null;
  reviewType: ModuleReviewType;
  decision: ModuleReviewDecision;
  comment: string | null;
  createdAt: string | null;
};

export type AdminModuleBoardItem = ModuleRecord & {
  latestArtifact: ModuleArtifactRecord | null;
};

export type AdminModuleBoardData = {
  actorRole: AdminModuleRole;
  modules: AdminModuleBoardItem[];
  pagination: PaginationState;
};

export type AdminModuleBrandGroup = {
  brandId: string;
  brandName: string;
  modules: AdminModuleBoardItem[];
};

export type AdminModuleBrandGroups = {
  actorRole: AdminModuleRole;
  groups: AdminModuleBrandGroup[];
};

export type AdminModuleDetail = {
  actorRole: AdminModuleRole;
  module: ModuleRecord;
  artifacts: ModuleArtifactRecord[];
  latestArtifact: ModuleArtifactRecord | null;
  reviews: ModuleReviewRecord[];
};

export type ClientModuleWorkspace = {
  access: {
    brandId: string;
    brandName: string;
    membershipRole: ClientModuleRole;
    planName: string | null;
  };
  modules: AdminModuleBoardItem[];
  pagination: PaginationState;
};

export type ClientModuleDetail = {
  access: ClientModuleWorkspace["access"];
  module: ModuleRecord;
  artifacts: ModuleArtifactRecord[];
  latestClientArtifact: ModuleArtifactRecord | null;
  reviews: ModuleReviewRecord[];
};

export type ClientModuleReviewPageData = ClientModuleDetail & {
  signedUrl: string | null;
  signedUrlExpiresInSeconds: number | null;
  markdown: string | null;
  comments: import("@/features/review-comments/types").ReviewComment[];
};

export type ModuleUploadFormState =
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
      moduleId: string;
      artifactId: string;
    };

export type ModuleActionFormState =
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
      moduleId: string;
    };

export type ModuleUploadInput = {
  moduleId: string;
  file: File;
  artifactType: ModuleArtifactType;
};
