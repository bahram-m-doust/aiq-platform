"use server";

import { revalidatePath } from "next/cache";

import { requireUserProfile } from "@/features/auth/queries";
import {
  validateRagSyncBrandFormData,
  validateRagApprovalTargetFormData,
} from "@/features/rag/schema";
import {
  approveRagAsPlatformOwner,
  approveRagAsSupervisor,
  isRagApprovalServiceError,
} from "@/features/rag/services";
import {
  isRagSyncServiceError,
  syncBrandKnowledgeBase,
} from "@/features/rag/sync";
import type {
  RagApprovalFormState,
  RagSyncFormState,
} from "@/features/rag/types";

function errorState(message: string): RagApprovalFormState {
  return { status: "error", message };
}

function syncErrorState(message: string): RagSyncFormState {
  return { status: "error", message };
}

export async function approveRagSupervisorAction(
  _previousState: RagApprovalFormState,
  formData: FormData,
): Promise<RagApprovalFormState> {
  const { profile } = await requireUserProfile("/admin/rag");
  const validation = validateRagApprovalTargetFormData(formData);

  if (validation.error || !validation.artifactId) {
    return errorState(validation.error ?? "RAG approval target is invalid.");
  }

  try {
    const result = await approveRagAsSupervisor({
      artifactId: validation.artifactId,
      actor: profile,
    });

    revalidatePath("/admin/rag");

    return {
      status: "success",
      message: result.message,
      artifactId: result.item.artifactId,
      ragStatus: result.item.ragStatus,
    };
  } catch (error) {
    if (isRagApprovalServiceError(error)) {
      return errorState(error.message);
    }

    return errorState("Supervisor RAG approval could not be recorded.");
  }
}

export async function approveRagPlatformOwnerAction(
  _previousState: RagApprovalFormState,
  formData: FormData,
): Promise<RagApprovalFormState> {
  const { profile } = await requireUserProfile("/admin/rag");
  const validation = validateRagApprovalTargetFormData(formData);

  if (validation.error || !validation.artifactId) {
    return errorState(validation.error ?? "RAG approval target is invalid.");
  }

  try {
    const result = await approveRagAsPlatformOwner({
      artifactId: validation.artifactId,
      actor: profile,
    });

    revalidatePath("/admin/rag");
    revalidatePath("/admin/modules");
    revalidatePath(`/admin/modules/${result.item.moduleId}`);

    return {
      status: "success",
      message: result.message,
      artifactId: result.item.artifactId,
      ragStatus: result.item.ragStatus,
    };
  } catch (error) {
    if (isRagApprovalServiceError(error)) {
      return errorState(error.message);
    }

    return errorState("Final RAG approval could not be recorded.");
  }
}

export async function syncBrandKnowledgeBaseAction(
  _previousState: RagSyncFormState,
  formData: FormData,
): Promise<RagSyncFormState> {
  const { profile } = await requireUserProfile("/admin/rag");
  const validation = validateRagSyncBrandFormData(formData);

  if (validation.error || !validation.brandId) {
    return syncErrorState(validation.error ?? "RAG sync brand is invalid.");
  }

  try {
    const result = await syncBrandKnowledgeBase({
      brandId: validation.brandId,
      triggeredBy: profile,
    });

    revalidatePath("/admin/rag");

    return {
      status: "success",
      message:
        result.failedCount > 0
          ? `${result.syncedCount} file(s) synced; ${result.failedCount} file(s) failed.`
          : `${result.syncedCount} file(s) synced to the brand knowledge base.`,
      brandId: result.brandId,
      syncedCount: result.syncedCount,
      failedCount: result.failedCount,
    };
  } catch (error) {
    if (isRagSyncServiceError(error)) {
      return syncErrorState(error.message);
    }

    return syncErrorState("RAG sync could not be completed.");
  }
}
