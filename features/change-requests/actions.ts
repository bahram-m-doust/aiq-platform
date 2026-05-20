"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUserProfile } from "@/features/auth/queries";
import { canReviewChangeRequestRole } from "@/features/change-requests/schema";
import {
  validateCreateChangeRequestFormData,
  validateReviewChangeRequestFormData,
} from "@/features/change-requests/schema";
import {
  createChangeRequest,
  isChangeRequestError,
  reviewChangeRequest,
} from "@/features/change-requests/services";
import type {
  CreateChangeRequestFormState,
  ReviewChangeRequestFormState,
} from "@/features/change-requests/types";

function createErrorState(message: string): CreateChangeRequestFormState {
  return { status: "error", message };
}

function reviewErrorState(message: string): ReviewChangeRequestFormState {
  return { status: "error", message };
}

export async function createChangeRequestAction(
  _previousState: CreateChangeRequestFormState,
  formData: FormData,
): Promise<CreateChangeRequestFormState> {
  const { profile } = await requireUserProfile("/dashboard/change-requests");
  const validation = validateCreateChangeRequestFormData(formData);

  if (validation.error || !validation.data) {
    return createErrorState(
      validation.error ?? "Change Request details are invalid.",
    );
  }

  try {
    const result = await createChangeRequest({
      input: validation.data,
      profileId: profile.id,
    });

    revalidatePath("/dashboard/change-requests");
    revalidatePath("/admin/change-requests");

    return {
      status: "success",
      message: "Change Request submitted for review.",
      requestId: result.request.id,
    };
  } catch (error) {
    if (isChangeRequestError(error)) {
      return createErrorState(error.message);
    }

    return createErrorState("Change Request could not be submitted.");
  }
}

export async function reviewChangeRequestAction(
  _previousState: ReviewChangeRequestFormState,
  formData: FormData,
): Promise<ReviewChangeRequestFormState> {
  const { profile } = await requireUserProfile("/admin/change-requests");

  if (!canReviewChangeRequestRole(profile.global_role)) {
    redirect("/dashboard");
  }

  const validation = validateReviewChangeRequestFormData(formData);

  if (validation.error || !validation.data) {
    return reviewErrorState(
      validation.error ?? "Change Request review details are invalid.",
    );
  }

  try {
    const request = await reviewChangeRequest({
      input: validation.data,
      reviewerId: profile.id,
      actorRole: profile.global_role,
    });

    revalidatePath("/admin/change-requests");
    revalidatePath("/dashboard/change-requests");

    return {
      status: "success",
      message: "Change Request status updated.",
      requestId: request.id,
      requestStatus: request.status,
    };
  } catch (error) {
    if (isChangeRequestError(error)) {
      return reviewErrorState(error.message);
    }

    return reviewErrorState("Change Request status could not be updated.");
  }
}
