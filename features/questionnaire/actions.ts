"use server";

import { revalidatePath } from "next/cache";

import { requireUser, requireUserProfile, requirePlatformOwner } from "@/features/auth/queries";
import {
  autosaveIntakeAnswer,
  autosaveIntakeAnswers,
  finalSubmitIntake,
  isFinalSubmitIntakeError,
  reopenIntakeSubmission,
  setIntakeAnswerMarkedDone,
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

// "Save & mark done": saves the answer value (same path as autosave) AND flags it
// as explicitly confirmed by the user, so the overview's Unanswered warning box
// can distinguish a confirmed answer from an autosaved-but-unconfirmed draft.
export async function markIntakeAnswerDoneAction(
  input: AutosaveIntakeAnswerInput,
): Promise<AutosaveIntakeAnswerResult> {
  const result = await autosaveIntakeAnswerAction(input);
  if (!result.ok) {
    return result;
  }
  // Best-effort: the answer is already saved; failing to set the flag just
  // leaves it listed as not-yet-done (no data loss).
  try {
    await setIntakeAnswerMarkedDone({
      sessionId: input.sessionId,
      questionId: input.questionId,
    });
  } catch (error) {
    logServerError({
      label: "[intake] mark done failed",
      error,
      metadata: { sessionId: input.sessionId, questionId: input.questionId },
    });
  }
  return result;
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
