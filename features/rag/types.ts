export const ragStatuses = [
  "NOT_ELIGIBLE",
  "CLIENT_APPROVED",
  "RAG_REVIEW_REQUIRED",
  "RAG_APPROVED",
  "SYNCING",
  "RAG_SYNCED",
  "SYNC_FAILED",
] as const;

export type RagStatus = (typeof ragStatuses)[number];

export const ragApprovalStages = ["SUPERVISOR", "PLATFORM_OWNER"] as const;
export type RagApprovalStage = (typeof ragApprovalStages)[number];

export type RagApprovalRole = "SUPERVISOR" | "PLATFORM_OWNER";

export type RagApprovalQueueItem = {
  brandId: string;
  brandName: string;
  moduleId: string;
  moduleTitle: string;
  moduleType: string;
  moduleStatus: string;
  artifactId: string;
  artifactVersion: number;
  artifactStatus: string;
  fileId: string;
  fileName: string;
  fileStatus: string;
  knowledgeFileId: string | null;
  ragStatus: RagStatus;
  approvedBySupervisor: string | null;
  approvedByPlatformOwner: string | null;
  createdAt: string | null;
};

export type RagApprovalFormState =
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
      artifactId: string;
      ragStatus: RagStatus;
    };

export type RagApprovedSyncFile = {
  knowledgeFileId: string;
  brandId: string;
  moduleId: string | null;
  artifactId: string;
  artifactVersion: number;
  fileId: string;
  storagePath: string;
  originalName: string;
  mimeType: string | null;
};

export type RagApprovalResult = {
  item: RagApprovalQueueItem;
  message: string;
  alreadyApproved: boolean;
};

export type RagSyncFileItem = RagApprovedSyncFile & {
  ragStatus: RagStatus;
  providerFileId: string | null;
  syncedAt: string | null;
};

export type RagSyncBrandGroup = {
  brandId: string;
  brandName: string;
  providerVectorStoreId: string | null;
  knowledgeBaseStatus: string;
  eligibleCount: number;
  retryableCount: number;
  syncingCount: number;
  syncedCount: number;
  failedCount: number;
  files: RagSyncFileItem[];
};

export type RagSyncFormState =
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
      brandId: string;
      syncedCount: number;
      failedCount: number;
    };

export type RagSyncResult = {
  brandId: string;
  providerVectorStoreId: string;
  attemptedCount: number;
  syncedCount: number;
  failedCount: number;
};
