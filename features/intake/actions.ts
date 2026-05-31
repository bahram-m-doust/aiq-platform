"use server";

import { revalidatePath } from "next/cache";

import { requireUser, requireUserProfile } from "@/features/auth/queries";
import {
  autosaveIntakeAnswer,
  autosaveIntakeAnswers,
  finalSubmitIntake,
  isFinalSubmitIntakeError,
} from "@/features/intake/services";
import type {
  AutosaveIntakeAnswerInput,
  AutosaveIntakeAnswerResult,
  AutosaveIntakeAnswersInput,
  AutosaveIntakeAnswersResult,
  FinalSubmitIntakeFormState,
} from "@/features/intake/types";

export async function autosaveIntakeAnswerAction(
  input: AutosaveIntakeAnswerInput,
): Promise<AutosaveIntakeAnswerResult> {
  const user = await requireUser("/dashboard/questionnaire");
  return autosaveIntakeAnswer({
    input,
    authUserId: user.id,
  });
}

export async function autosaveIntakeAnswersAction(
  input: AutosaveIntakeAnswersInput,
): Promise<AutosaveIntakeAnswersResult> {
  const user = await requireUser("/dashboard/questionnaire");
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
  const { profile } = await requireUserProfile("/dashboard/questionnaire");
  const sessionId = formValue(formData, "session_id");

  if (!sessionId) {
    return finalSubmitErrorState("The intake session could not be submitted.");
  }

  try {
    const result = await finalSubmitIntake({
      sessionId,
      profileId: profile.id,
      actorRole: profile.global_role,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/questionnaire");
    result.sectionKeys.forEach((sectionKey) => {
      revalidatePath(`/dashboard/questionnaire/${sectionKey}`);
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
