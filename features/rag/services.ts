import "server-only";

import { getEligibleRagApprovalItemByArtifactId } from "@/features/rag/queries";
import {
  canPlatformOwnerApproveRag,
  canSupervisorApproveRag,
  safeRagStatus,
  toRagApprovalAuditMetadata,
} from "@/features/rag/schema";
import type {
  RagApprovalQueueItem,
  RagApprovalResult,
  RagApprovalStage,
  RagStatus,
} from "@/features/rag/types";
import { logAudit } from "@/lib/audit/logAudit";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserProfile } from "@/features/auth/types";

type RagApprovalTransitionRow = {
  knowledge_file_id: string;
  knowledge_brand_id: string;
  knowledge_module_id: string | null;
  knowledge_file_record_id: string | null;
  knowledge_rag_status: string;
  knowledge_approved_by_supervisor: string | null;
  knowledge_approved_by_platform_owner: string | null;
  knowledge_created_at: string | null;
  previous_rag_status: string;
  current_module_status: string;
  current_artifact_status: string;
  current_file_status: string;
  changed: boolean;
};

const CODE = "rag_approval";

function ragApprovalError(message: string): never {
  throw new DomainError(CODE, message);
}

export function isRagApprovalServiceError(
  error: unknown,
): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}

async function requireQueueItem(artifactId: string) {
  const item = await getEligibleRagApprovalItemByArtifactId(artifactId);

  if (!item) {
    ragApprovalError("Brain approval item could not be found.");
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
}: {
  item: RagApprovalQueueItem;
  row: RagApprovalTransitionRow;
}): RagApprovalQueueItem {
  return {
    ...item,
    moduleStatus: row.current_module_status,
    artifactStatus: row.current_artifact_status,
    fileStatus: row.current_file_status,
    knowledgeFileId: row.knowledge_file_id,
    ragStatus: safeRagStatus(row.knowledge_rag_status),
    approvedBySupervisor: row.knowledge_approved_by_supervisor,
    approvedByPlatformOwner: row.knowledge_approved_by_platform_owner,
    createdAt: row.knowledge_created_at,
  };
}

async function transitionRagApproval({
  stage,
  artifactId,
  actor,
}: {
  stage: RagApprovalStage;
  artifactId: string;
  actor: UserProfile;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .rpc("transition_rag_approval", {
      p_stage: stage,
      p_artifact_id: artifactId,
      p_actor_id: actor.id,
    })
    .single();

  if (error) {
    if (
      error.message?.includes(
        "Supervisor approval is required before final approval.",
      )
    ) {
      ragApprovalError(
        "Supervisor approval is required before final approval.",
      );
    }

    throw error;
  }

  return data as unknown as RagApprovalTransitionRow;
}

export async function approveRagAsSupervisor({
  artifactId,
  actor,
}: {
  artifactId: string;
  actor: UserProfile;
}): Promise<RagApprovalResult> {
  if (!canSupervisorApproveRag(actor.global_role)) {
    ragApprovalError("Only Supervisors can perform Supervisor Brain approval.");
  }

  const item = await requireQueueItem(artifactId);

  const transition = await transitionRagApproval({
    stage: "SUPERVISOR",
    artifactId,
    actor,
  });
  const updatedItem = withKnowledgeState({
    item,
    row: transition,
  });

  if (transition.changed) {
    await insertRagApprovalAudit({
      item,
      actor,
      oldStatus: safeRagStatus(transition.previous_rag_status),
      newStatus: updatedItem.ragStatus,
      approvalStage: "SUPERVISOR",
      knowledgeFileId: transition.knowledge_file_id,
    });
  }

  const finalState = [
    "RAG_APPROVED",
    "SYNCING",
    "RAG_SYNCED",
    "SYNC_FAILED",
  ].includes(updatedItem.ragStatus);

  return {
    item: updatedItem,
    message: transition.changed && finalState
      ? "Brain approval consistency repaired."
      : transition.changed
        ? "Supervisor Brain approval recorded."
      : finalState
        ? "This file is already Brain approved."
        : "Supervisor approval is already recorded.",
    alreadyApproved: !transition.changed && finalState,
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
    ragApprovalError("Only Platform Owners can perform final Brain approval.");
  }

  const item = await requireQueueItem(artifactId);

  const transition = await transitionRagApproval({
    stage: "PLATFORM_OWNER",
    artifactId,
    actor,
  });
  const updatedItem = withKnowledgeState({
    item,
    row: transition,
  });

  if (transition.changed) {
    await insertRagApprovalAudit({
      item,
      actor,
      oldStatus: safeRagStatus(transition.previous_rag_status),
      newStatus: updatedItem.ragStatus,
      approvalStage: "PLATFORM_OWNER",
      knowledgeFileId: transition.knowledge_file_id,
    });
  }

  return {
    item: updatedItem,
    message: transition.changed
      ? "Final Brain approval recorded."
      : "This file is already Brain approved.",
    alreadyApproved: !transition.changed,
  };
}
