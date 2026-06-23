"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser, requireUserProfile, requirePlatformOwner } from "@/features/auth/queries";
import {
  autosaveIntakeAnswer,
  autosaveIntakeAnswers,
  clearIntakeAnswerMarkedDone,
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

async function revalidateIntakeViews(questionIds: string[] = []) {
  revalidatePath(ROUTES.brainRoadmap);
  revalidatePath(ROUTES.questionnaire);

  if (questionIds.length === 0) {
    return;
  }

  try {
    const { getIntakeSectionsWithQuestions } = await import(
      "@/features/questionnaire/queries"
    );
    const questionIdSet = new Set(questionIds);
    const sections = await getIntakeSectionsWithQuestions();

    sections
      .filter((section) =>
        section.questions.some((question) => questionIdSet.has(question.id)),
      )
      .forEach((section) => {
        revalidatePath(questionnaireSectionPath(section.key));
      });
  } catch (error) {
    logServerError({
      label: "[intake] revalidate views failed",
      error,
      metadata: { questionIds },
    });
  }
}

export async function autosaveIntakeAnswerAction(
  input: AutosaveIntakeAnswerInput,
): Promise<AutosaveIntakeAnswerResult> {
  const user = await requireUser(ROUTES.questionnaire);
  const result = await autosaveIntakeAnswer({
    input,
    authUserId: user.id,
  });
  if (result.ok) {
    await revalidateIntakeViews([result.questionId]);
  }
  return result;
}

export async function autosaveIntakeAnswersAction(
  input: AutosaveIntakeAnswersInput,
): Promise<AutosaveIntakeAnswersResult> {
  const user = await requireUser(ROUTES.questionnaire);
  const result = await autosaveIntakeAnswers({
    input,
    authUserId: user.id,
  });
  if (result.ok) {
    await revalidateIntakeViews(
      result.answers.map((answer) => answer.questionId),
    );
  }
  return result;
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
    await revalidateIntakeViews([input.questionId]);
  } catch (error) {
    logServerError({
      label: "[intake] mark done failed",
      error,
      metadata: { sessionId: input.sessionId, questionId: input.questionId },
    });
  }
  return result;
}

// "Edit": reverts an answer to an unconfirmed draft so it stays a draft after
// the user navigates away and back. Best-effort and idempotent — the answer
// value is untouched, only the explicit confirmation flag is cleared.
export async function clearIntakeAnswerDoneAction(input: {
  sessionId: string;
  questionId: string;
}): Promise<void> {
  await requireUser(ROUTES.questionnaire);
  try {
    await clearIntakeAnswerMarkedDone({
      sessionId: input.sessionId,
      questionId: input.questionId,
    });
    await revalidateIntakeViews([input.questionId]);
  } catch (error) {
    logServerError({
      label: "[intake] clear mark done failed",
      error,
      metadata: { sessionId: input.sessionId, questionId: input.questionId },
    });
  }
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
    revalidatePath(ROUTES.brainRoadmap);
    revalidatePath(ROUTES.questionnaire);
    result.sectionKeys.forEach((sectionKey) => {
      revalidatePath(questionnaireSectionPath(sectionKey));
    });
  } catch (error) {
    if (isFinalSubmitIntakeError(error)) {
      return finalSubmitErrorState(error.message);
    }

    return finalSubmitErrorState(
      "Questionnaire could not be submitted. Please try again.",
    );
  }

  redirect(`${ROUTES.brainRoadmap}?open=brand-research`);
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
