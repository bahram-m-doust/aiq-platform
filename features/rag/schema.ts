import type {
  RagApprovalFormState,
  RagApprovalQueueItem,
  RagApprovalRole,
  RagApprovalStage,
  RagSyncFormState,
  RagStatus,
} from "@/features/rag/types";
import { ragApprovalStages, ragStatuses } from "@/features/rag/types";

export const initialRagApprovalFormState: RagApprovalFormState = {
  status: "idle",
  message: "",
};

export const initialRagSyncFormState: RagSyncFormState = {
  status: "idle",
  message: "",
};

export const eligibleRagModuleStatuses = [
  "CLIENT_APPROVED",
  "RAG_REVIEW_REQUIRED",
  "RAG_APPROVED",
] as const;

export const eligibleRagArtifactStatuses = [
  "CLIENT_APPROVED",
  "RAG_REVIEW_REQUIRED",
  "RAG_APPROVED",
] as const;

export const eligibleRagFileStatuses = [
  "CLIENT_APPROVED",
  "RAG_APPROVED",
] as const;

export const ragStatusLabels: Record<RagStatus, string> = {
  NOT_ELIGIBLE: "Not eligible",
  CLIENT_APPROVED: "Client approved",
  RAG_REVIEW_REQUIRED: "Supervisor approved",
  RAG_APPROVED: "RAG approved",
  SYNCING: "Syncing",
  RAG_SYNCED: "RAG synced",
  SYNC_FAILED: "Sync failed",
};

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function isRagStatus(value: string): value is RagStatus {
  return ragStatuses.includes(value as RagStatus);
}

export function isRagApprovalStage(
  value: string,
): value is RagApprovalStage {
  return ragApprovalStages.includes(value as RagApprovalStage);
}

export function safeRagStatus(value: string | null | undefined): RagStatus {
  return value && isRagStatus(value) ? value : "CLIENT_APPROVED";
}

export function canViewRagApprovalQueueRole(
  role: string | null | undefined,
): role is RagApprovalRole {
  return role === "SUPERVISOR" || role === "PLATFORM_OWNER";
}

export function canSupervisorApproveRag(role: string | null | undefined) {
  return role === "SUPERVISOR";
}

export function canPlatformOwnerApproveRag(role: string | null | undefined) {
  return role === "PLATFORM_OWNER";
}

export function canSyncRagRole(role: string | null | undefined) {
  return role === "PLATFORM_OWNER";
}

export function isEligibleRagModuleStatus(status: string | null | undefined) {
  return eligibleRagModuleStatuses.includes(
    status as (typeof eligibleRagModuleStatuses)[number],
  );
}

export function isEligibleRagArtifactStatus(
  status: string | null | undefined,
) {
  return eligibleRagArtifactStatuses.includes(
    status as (typeof eligibleRagArtifactStatuses)[number],
  );
}

export function isEligibleRagFileStatus(status: string | null | undefined) {
  return eligibleRagFileStatuses.includes(
    status as (typeof eligibleRagFileStatuses)[number],
  );
}

export function validateRagApprovalTargetFormData(
  formData: FormData,
): { artifactId: string | null; error: string | null } {
  const artifactId = formString(formData, "artifact_id");

  if (!artifactId) {
    return { artifactId: null, error: "RAG approval target is missing." };
  }

  return { artifactId, error: null };
}

export function ragApprovalStateForItem(item: RagApprovalQueueItem) {
  if (item.ragStatus === "RAG_SYNCED") {
    return "SYNCED";
  }

  if (item.ragStatus === "SYNCING") {
    return "SYNCING";
  }

  if (item.ragStatus === "SYNC_FAILED") {
    return "SYNC_FAILED";
  }

  if (item.ragStatus === "RAG_APPROVED") {
    return "APPROVED";
  }

  if (item.approvedBySupervisor || item.ragStatus === "RAG_REVIEW_REQUIRED") {
    return "PENDING_PLATFORM_OWNER";
  }

  return "PENDING_SUPERVISOR";
}

export function toRagApprovalAuditMetadata({
  item,
  oldStatus,
  newStatus,
  approvalStage,
  actorId,
}: {
  item: Pick<
    RagApprovalQueueItem,
    "brandId" | "moduleId" | "artifactId" | "fileId"
  >;
  oldStatus: RagStatus;
  newStatus: RagStatus;
  approvalStage: RagApprovalStage;
  actorId: string;
}) {
  return {
    brand_id: item.brandId,
    module_id: item.moduleId,
    artifact_id: item.artifactId,
    file_id: item.fileId,
    old_status: oldStatus,
    new_status: newStatus,
    approval_stage: approvalStage,
    actor_id: actorId,
  };
}

// Statuses a sync run may (re-)process: freshly approved files, failed syncs
// (retry), and files stuck in SYNCING after a crashed/timed-out run — without
// the latter two, one bad run would strand a file forever with no recovery
// path. Sync runs are manual, brand-scoped admin actions, so taking over a
// stale SYNCING row is safe in practice.
export const ragRetryableSyncStatuses = [
  "RAG_APPROVED",
  "SYNC_FAILED",
  "SYNCING",
] as const;

export function isRagApprovedSyncEligible({
  ragStatus,
  fileStatus,
  brandMatches,
  moduleStatus = "RAG_APPROVED",
  artifactType = "PDF",
  artifactStatus = "RAG_APPROVED",
}: {
  ragStatus: string | null | undefined;
  fileStatus: string | null | undefined;
  brandMatches: boolean;
  moduleStatus?: string | null | undefined;
  artifactType?: string | null | undefined;
  artifactStatus?: string | null | undefined;
}) {
  return (
    brandMatches &&
    (ragRetryableSyncStatuses as readonly string[]).includes(ragStatus ?? "") &&
    fileStatus === "RAG_APPROVED" &&
    moduleStatus === "RAG_APPROVED" &&
    artifactType === "PDF" &&
    artifactStatus === "RAG_APPROVED"
  );
}

export function isRagSyncDisplayEligible({
  ragStatus,
  fileStatus,
  brandMatches,
  moduleStatus,
  artifactType,
  artifactStatus,
}: {
  ragStatus: string | null | undefined;
  fileStatus: string | null | undefined;
  brandMatches: boolean;
  moduleStatus: string | null | undefined;
  artifactType: string | null | undefined;
  artifactStatus: string | null | undefined;
}) {
  return (
    brandMatches &&
    ["RAG_APPROVED", "SYNCING", "RAG_SYNCED", "SYNC_FAILED"].includes(
      ragStatus ?? "",
    ) &&
    fileStatus === "RAG_APPROVED" &&
    moduleStatus === "RAG_APPROVED" &&
    artifactType === "PDF" &&
    artifactStatus === "RAG_APPROVED"
  );
}

export function validateRagSyncBrandFormData(
  formData: FormData,
): { brandId: string | null; error: string | null } {
  const brandId = formString(formData, "brand_id");

  if (!brandId) {
    return { brandId: null, error: "RAG sync brand is missing." };
  }

  return { brandId, error: null };
}

export function toRagSyncAuditMetadata({
  brandId,
  providerVectorStoreId,
  actorId,
  attemptedKnowledgeFileIds,
  syncedKnowledgeFileIds,
  failedKnowledgeFileIds,
  oldStatus,
  newStatus,
}: {
  brandId: string;
  providerVectorStoreId: string | null;
  actorId: string;
  attemptedKnowledgeFileIds: string[];
  syncedKnowledgeFileIds: string[];
  failedKnowledgeFileIds: string[];
  oldStatus: string;
  newStatus: string;
}) {
  return {
    brand_id: brandId,
    provider_vector_store_id: providerVectorStoreId,
    actor_id: actorId,
    attempted_knowledge_file_ids: attemptedKnowledgeFileIds,
    synced_knowledge_file_ids: syncedKnowledgeFileIds,
    failed_knowledge_file_ids: failedKnowledgeFileIds,
    attempted_count: attemptedKnowledgeFileIds.length,
    synced_count: syncedKnowledgeFileIds.length,
    failed_count: failedKnowledgeFileIds.length,
    old_status: oldStatus,
    new_status: newStatus,
  };
}
