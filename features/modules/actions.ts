"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUserProfile } from "@/features/auth/queries";
import {
  validateClientModuleCommentFormData,
  validateClientModuleDecisionFormData,
} from "@/features/modules/schema";
import {
  addClientModuleComment,
  isModuleServiceError,
  sendModuleToClientReview,
  submitClientModuleDecision,
  uploadModuleArtifactFromFormData,
} from "@/features/modules/services";
import type {
  ModuleActionFormState,
  ModuleUploadFormState,
} from "@/features/modules/types";

function uploadErrorState(message: string): ModuleUploadFormState {
  return { status: "error", message };
}

function actionErrorState(message: string): ModuleActionFormState {
  return { status: "error", message };
}

function readModuleId(formData: FormData) {
  const value = formData.get("module_id");
  return typeof value === "string" ? value.trim() : "";
}

export async function uploadModuleArtifactAction(
  _previousState: ModuleUploadFormState,
  formData: FormData,
): Promise<ModuleUploadFormState> {
  const { profile } = await requireUserProfile("/admin/modules");

  try {
    const result = await uploadModuleArtifactFromFormData({
      formData,
      profile,
    });

    revalidatePath("/admin/modules");
    revalidatePath(`/admin/modules/${result.module.id}`);

    return {
      status: "success",
      message: "Module draft uploaded for internal review.",
      moduleId: result.module.id,
      artifactId: result.artifact.id,
    };
  } catch (error) {
    if (isModuleServiceError(error)) {
      return uploadErrorState(error.message);
    }

    return uploadErrorState("Module draft could not be uploaded.");
  }
}

export async function sendModuleToClientReviewAction(
  _previousState: ModuleActionFormState,
  formData: FormData,
): Promise<ModuleActionFormState> {
  const moduleId = readModuleId(formData);
  const { profile } = await requireUserProfile(
    moduleId ? `/admin/modules/${moduleId}` : "/admin/modules",
  );

  if (!moduleId) {
    return actionErrorState("Module is missing.");
  }

  try {
    await sendModuleToClientReview({ moduleId, profile });

    revalidatePath("/admin/modules");
    revalidatePath(`/admin/modules/${moduleId}`);
    revalidatePath("/dashboard/modules");

    return {
      status: "success",
      message: "Module sent to client review.",
      moduleId,
    };
  } catch (error) {
    if (isModuleServiceError(error)) {
      return actionErrorState(error.message);
    }

    return actionErrorState("Module could not be sent to client review.");
  }
}

export async function addClientModuleCommentAction(
  _previousState: ModuleActionFormState,
  formData: FormData,
): Promise<ModuleActionFormState> {
  const validation = validateClientModuleCommentFormData(formData);
  const nextPath = validation.data
    ? `/dashboard/modules/${validation.data.moduleId}`
    : "/dashboard/modules";
  const { profile } = await requireUserProfile(nextPath);

  if (validation.error || !validation.data) {
    return actionErrorState(validation.error ?? "Comment details are invalid.");
  }

  try {
    await addClientModuleComment({
      moduleId: validation.data.moduleId,
      profile,
      comment: validation.data.comment,
    });

    revalidatePath(`/dashboard/modules/${validation.data.moduleId}`);

    return {
      status: "success",
      message: "Comment recorded.",
      moduleId: validation.data.moduleId,
    };
  } catch (error) {
    if (isModuleServiceError(error)) {
      return actionErrorState(error.message);
    }

    return actionErrorState("Comment could not be recorded.");
  }
}

export async function approveClientModuleAction(
  _previousState: ModuleActionFormState,
  formData: FormData,
): Promise<ModuleActionFormState> {
  const validation = validateClientModuleDecisionFormData({
    formData,
    requireComment: false,
  });
  const nextPath = validation.data
    ? `/dashboard/modules/${validation.data.moduleId}`
    : "/dashboard/modules";
  const { profile } = await requireUserProfile(nextPath);

  if (validation.error || !validation.data) {
    return actionErrorState(validation.error ?? "Module decision is invalid.");
  }

  try {
    await submitClientModuleDecision({
      moduleId: validation.data.moduleId,
      profile,
      decision: "APPROVE",
      comment: validation.data.comment,
    });

    revalidatePath("/dashboard/modules");
    revalidatePath(`/dashboard/modules/${validation.data.moduleId}`);
    revalidatePath("/admin/modules");
    revalidatePath(`/admin/modules/${validation.data.moduleId}`);

    return {
      status: "success",
      message: "Module approved by the client.",
      moduleId: validation.data.moduleId,
    };
  } catch (error) {
    if (isModuleServiceError(error)) {
      return actionErrorState(error.message);
    }

    return actionErrorState("Module approval could not be recorded.");
  }
}

export async function requestClientModuleChangeAction(
  _previousState: ModuleActionFormState,
  formData: FormData,
): Promise<ModuleActionFormState> {
  const validation = validateClientModuleDecisionFormData({
    formData,
    requireComment: true,
  });
  const nextPath = validation.data
    ? `/dashboard/modules/${validation.data.moduleId}`
    : "/dashboard/modules";
  const { profile } = await requireUserProfile(nextPath);

  if (validation.error || !validation.data) {
    return actionErrorState(validation.error ?? "Module decision is invalid.");
  }

  try {
    await submitClientModuleDecision({
      moduleId: validation.data.moduleId,
      profile,
      decision: "REQUEST_CHANGE",
      comment: validation.data.comment,
    });

    revalidatePath("/dashboard/modules");
    revalidatePath(`/dashboard/modules/${validation.data.moduleId}`);
    revalidatePath("/admin/modules");
    revalidatePath(`/admin/modules/${validation.data.moduleId}`);

    return {
      status: "success",
      message: "Module change request recorded.",
      moduleId: validation.data.moduleId,
    };
  } catch (error) {
    if (isModuleServiceError(error)) {
      return actionErrorState(error.message);
    }

    return actionErrorState("Module change request could not be recorded.");
  }
}

export async function returnToModulesAction() {
  redirect("/dashboard/modules");
}
