"use server";

import { revalidatePath } from "next/cache";

import { requireUser, requireUserProfile, requirePlatformOwner } from "@/features/auth/queries";
import {
  autosaveIntakeAnswer,
  autosaveIntakeAnswers,
  finalSubmitIntake,
  isFinalSubmitIntakeError,
  reopenIntakeSubmission,
} from "@/features/questionnaire/services";
import type {
  AutosaveIntakeAnswerInput,
  AutosaveIntakeAnswerResult,
  AutosaveIntakeAnswersInput,
  AutosaveIntakeAnswersResult,
  FinalSubmitIntakeFormState,
  ReopenIntakeFormState,
} from "@/features/questionnaire/types";
import { logServerError } from "@/lib/logging/server";
import { ROUTES, questionnaireSectionPath } from "@/lib/routes";

export async function autosaveIntakeAnswerAction(
  input: AutosaveIntakeAnswerInput,
): Promise<AutosaveIntakeAnswerResult> {
  const user = await requireUser(ROUTES.questionnaire);
  return autosaveIntakeAnswer({
    input,
    authUserId: user.id,
  });
}

export async function autosaveIntakeAnswersAction(
  input: AutosaveIntakeAnswersInput,
): Promise<AutosaveIntakeAnswersResult> {
  const user = await requireUser(ROUTES.questionnaire);
  return autosaveIntakeAnswers({
    input,
    authUserId: user.id,
  });
}

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function finalSubmitErrorState(message: string): FinalSubmitIntakeFormState {
  return { status: "error", message };
}

export async function finalSubmitIntakeAction(
  _previousState: FinalSubmitIntakeFormState,
  formData: FormData,
): Promise<FinalSubmitIntakeFormState> {
  const { profile } = await requireUserProfile(ROUTES.questionnaire);
  const sessionId = formValue(formData, "session_id");

  if (!sessionId) {
    return finalSubmitErrorState("The questionnaire could not be submitted.");
  }

  try {
    const result = await finalSubmitIntake({
      sessionId,
      profileId: profile.id,
      actorRole: profile.global_role,
    });

    revalidatePath("/home");
    revalidatePath(ROUTES.questionnaire);
    result.sectionKeys.forEach((sectionKey) => {
      revalidatePath(questionnaireSectionPath(sectionKey));
    });

    return {
      status: "success",
      message: "Questionnaire has been submitted and locked.",
      snapshotId: result.snapshotId,
    };
  } catch (error) {
    if (isFinalSubmitIntakeError(error)) {
      return finalSubmitErrorState(error.message);
    }

    return finalSubmitErrorState(
      "Questionnaire could not be submitted. Please try again.",
    );
  }
}

// Admin (platform owner) sends a locked questionnaire back to the brand owner
// for editing.
export async function reopenIntakeSubmissionAction(
  _previousState: ReopenIntakeFormState,
  formData: FormData,
): Promise<ReopenIntakeFormState> {
  const { profile } = await requirePlatformOwner("/admin/submissions");
  const snapshotId = formValue(formData, "snapshot_id");

  if (!snapshotId) {
    return { status: "error", message: "Submission not found." };
  }

  try {
    await reopenIntakeSubmission({
      snapshotId,
      profileId: profile.id,
      actorRole: profile.global_role,
    });

    // Refresh the admin list and the owner's questionnaire views.
    revalidatePath("/admin/submissions");
    revalidatePath(ROUTES.questionnaire);

    return {
      status: "success",
      message: "Questionnaire reopened for the brand owner.",
    };
  } catch (error) {
    if (isFinalSubmitIntakeError(error)) {
      return { status: "error", message: error.message };
    }

    logServerError({
      label: "[intake] reopen failed",
      error,
      metadata: { profileId: profile.id, snapshotId },
    });
    return {
      status: "error",
      message: "Could not reopen the questionnaire. Please try again.",
    };
  }
}
