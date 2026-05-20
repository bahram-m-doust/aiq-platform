import "server-only";

import { getEligibleRagApprovalItemByArtifactId } from "@/features/rag/queries";
import {
  canPlatformOwnerApproveRag,
  canSupervisorApproveRag,
  toRagApprovalAuditMetadata,
} from "@/features/rag/schema";
import type {
  RagApprovalQueueItem,
  RagApprovalResult,
  RagApprovalStage,
  RagStatus,
} from "@/features/rag/types";
import { logAudit } from "@/lib/audit/logAudit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserProfile } from "@/features/auth/types";

type KnowledgeFileRow = {
  id: string;
  brand_id: string;
  module_id: string | null;
  file_id: string | null;
  rag_status: string;
  approved_by_supervisor: string | null;
  approved_by_platform_owner: string | null;
  created_at: string | null;
};

const knowledgeFileColumns = [
  "id",
  "brand_id",
  "module_id",
  "file_id",
  "rag_status",
  "approved_by_supervisor",
  "approved_by_platform_owner",
  "created_at",
].join(", ");

class RagApprovalServiceError extends Error {
  name = "RagApprovalServiceError";
}

function ragApprovalError(message: string): never {
  throw new RagApprovalServiceError(message);
}

export function isRagApprovalServiceError(
  error: unknown,
): error is RagApprovalServiceError {
  return error instanceof RagApprovalServiceError;
}

async function requireQueueItem(artifactId: string) {
  const item = await getEligibleRagApprovalItemByArtifactId(artifactId);

  if (!item) {
    ragApprovalError("RAG approval item could not be found.");
  }

  return item;
}

async function insertRagApprovalAudit({
  item,
  actor,
  oldStatus,
  newStatus,
  approvalStage,
  knowledgeFileId,
}: {
  item: RagApprovalQueueItem;
  actor: UserProfile;
  oldStatus: RagStatus;
  newStatus: RagStatus;
  approvalStage: RagApprovalStage;
  knowledgeFileId: string;
}) {
  await logAudit({
    actorUserId: actor.id,
    actorRole: actor.global_role,
    brandId: item.brandId,
    action: "rag_approved",
    entityType: "knowledge_file",
    entityId: knowledgeFileId,
    before: toRagApprovalAuditMetadata({
      item,
      oldStatus,
      newStatus: oldStatus,
      approvalStage,
      actorId: actor.id,
    }),
    after: toRagApprovalAuditMetadata({
      item,
      oldStatus,
      newStatus,
      approvalStage,
      actorId: actor.id,
    }),
  });
}

function withKnowledgeState({
  item,
  row,
  ragStatus,
}: {
  item: RagApprovalQueueItem;
  row: KnowledgeFileRow;
  ragStatus: RagStatus;
}): RagApprovalQueueItem {
  return {
    ...item,
    knowledgeFileId: row.id,
    ragStatus,
    approvedBySupervisor: row.approved_by_supervisor,
    approvedByPlatformOwner: row.approved_by_platform_owner,
    createdAt: row.created_at,
  };
}

async function upsertSupervisorKnowledgeFile({
  item,
  actor,
}: {
  item: RagApprovalQueueItem;
  actor: UserProfile;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_files")
    .upsert(
      {
        brand_id: item.brandId,
        module_id: item.moduleId,
        file_id: item.fileId,
        rag_status: "RAG_REVIEW_REQUIRED",
        approved_by_supervisor: actor.id,
      },
      {
        onConflict: "brand_id,file_id",
      },
    )
    .select(knowledgeFileColumns)
    .single();

  if (error) {
    throw error;
  }

  return data as unknown as KnowledgeFileRow;
}

async function updateModuleAndArtifactForSupervisor(item: RagApprovalQueueItem) {
  const admin = createAdminClient();
  const [moduleResult, artifactResult] = await Promise.all([
    admin
      .from("brand_modules")
      .update({
        status: "RAG_REVIEW_REQUIRED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.moduleId)
      .eq("brand_id", item.brandId)
      .neq("status", "RAG_APPROVED"),
    admin
      .from("module_artifacts")
      .update({ status: "RAG_REVIEW_REQUIRED" })
      .eq("id", item.artifactId)
      .eq("module_id", item.moduleId)
      .neq("status", "RAG_APPROVED"),
  ]);

  if (moduleResult.error) {
    throw moduleResult.error;
  }

  if (artifactResult.error) {
    throw artifactResult.error;
  }
}

async function updateFinalRagApproval({
  item,
  actor,
}: {
  item: RagApprovalQueueItem;
  actor: UserProfile;
}) {
  if (!item.knowledgeFileId) {
    ragApprovalError("Supervisor approval is required before final approval.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_files")
    .update({
      module_id: item.moduleId,
      rag_status: "RAG_APPROVED",
      approved_by_platform_owner: actor.id,
    })
    .eq("id", item.knowledgeFileId)
    .eq("brand_id", item.brandId)
    .eq("file_id", item.fileId)
    .select(knowledgeFileColumns)
    .single();

  if (error) {
    throw error;
  }

  return data as unknown as KnowledgeFileRow;
}

async function updateModuleArtifactAndFileForFinalApproval(
  item: RagApprovalQueueItem,
) {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const [moduleResult, artifactResult, fileResult] = await Promise.all([
    admin
      .from("brand_modules")
      .update({ status: "RAG_APPROVED", updated_at: nowIso })
      .eq("id", item.moduleId)
      .eq("brand_id", item.brandId),
    admin
      .from("module_artifacts")
      .update({ status: "RAG_APPROVED" })
      .eq("id", item.artifactId)
      .eq("module_id", item.moduleId),
    admin
      .from("files")
      .update({ status: "RAG_APPROVED" })
      .eq("id", item.fileId)
      .eq("brand_id", item.brandId),
  ]);

  if (moduleResult.error) {
    throw moduleResult.error;
  }

  if (artifactResult.error) {
    throw artifactResult.error;
  }

  if (fileResult.error) {
    throw fileResult.error;
  }
}

export async function approveRagAsSupervisor({
  artifactId,
  actor,
}: {
  artifactId: string;
  actor: UserProfile;
}): Promise<RagApprovalResult> {
  if (!canSupervisorApproveRag(actor.global_role)) {
    ragApprovalError("Only Supervisors can perform Supervisor RAG approval.");
  }

  const item = await requireQueueItem(artifactId);

  if (item.ragStatus === "RAG_APPROVED") {
    return {
      item,
      message: "This file is already RAG approved.",
      alreadyApproved: true,
    };
  }

  if (item.approvedBySupervisor || item.ragStatus === "RAG_REVIEW_REQUIRED") {
    return {
      item,
      message: "Supervisor approval is already recorded.",
      alreadyApproved: false,
    };
  }

  const oldStatus = item.ragStatus;
  const knowledgeFile = await upsertSupervisorKnowledgeFile({ item, actor });

  await updateModuleAndArtifactForSupervisor(item);

  const updatedItem = withKnowledgeState({
    item: {
      ...item,
      moduleStatus:
        item.moduleStatus === "RAG_APPROVED"
          ? "RAG_APPROVED"
          : "RAG_REVIEW_REQUIRED",
      artifactStatus:
        item.artifactStatus === "RAG_APPROVED"
          ? "RAG_APPROVED"
          : "RAG_REVIEW_REQUIRED",
    },
    row: knowledgeFile,
    ragStatus: "RAG_REVIEW_REQUIRED",
  });

  await insertRagApprovalAudit({
    item,
    actor,
    oldStatus,
    newStatus: "RAG_REVIEW_REQUIRED",
    approvalStage: "SUPERVISOR",
    knowledgeFileId: knowledgeFile.id,
  });

  return {
    item: updatedItem,
    message: "Supervisor RAG approval recorded.",
    alreadyApproved: false,
  };
}

export async function approveRagAsPlatformOwner({
  artifactId,
  actor,
}: {
  artifactId: string;
  actor: UserProfile;
}): Promise<RagApprovalResult> {
  if (!canPlatformOwnerApproveRag(actor.global_role)) {
    ragApprovalError("Only Platform Owners can perform final RAG approval.");
  }

  const item = await requireQueueItem(artifactId);

  if (item.ragStatus === "RAG_APPROVED") {
    return {
      item,
      message: "This file is already RAG approved.",
      alreadyApproved: true,
    };
  }

  if (!item.approvedBySupervisor) {
    ragApprovalError("Supervisor approval is required before final approval.");
  }

  const oldStatus = item.ragStatus;
  const knowledgeFile = await updateFinalRagApproval({ item, actor });

  await updateModuleArtifactAndFileForFinalApproval(item);

  const updatedItem = withKnowledgeState({
    item: {
      ...item,
      moduleStatus: "RAG_APPROVED",
      artifactStatus: "RAG_APPROVED",
      fileStatus: "RAG_APPROVED",
    },
    row: knowledgeFile,
    ragStatus: "RAG_APPROVED",
  });

  await insertRagApprovalAudit({
    item,
    actor,
    oldStatus,
    newStatus: "RAG_APPROVED",
    approvalStage: "PLATFORM_OWNER",
    knowledgeFileId: knowledgeFile.id,
  });

  return {
    item: updatedItem,
    message: "Final RAG approval recorded.",
    alreadyApproved: false,
  };
}
