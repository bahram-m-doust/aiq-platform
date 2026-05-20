"use server";

import { revalidatePath } from "next/cache";

import { requireUserProfile } from "@/features/auth/queries";
import {
  autosaveIntakeAnswer,
  finalSubmitIntake,
  isFinalSubmitIntakeError,
} from "@/features/intake/services";
import type {
  AutosaveIntakeAnswerInput,
  AutosaveIntakeAnswerResult,
  FinalSubmitIntakeFormState,
} from "@/features/intake/types";

export async function autosaveIntakeAnswerAction(
  input: AutosaveIntakeAnswerInput,
): Promise<AutosaveIntakeAnswerResult> {
  const { profile } = await requireUserProfile("/dashboard/intake");
  const result = await autosaveIntakeAnswer({
    input,
    profileId: profile.id,
    actorRole: profile.global_role,
  });

  if (result.ok) {
    revalidatePath("/dashboard/intake");
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
  const { profile } = await requireUserProfile("/dashboard/intake");
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
    revalidatePath("/dashboard/intake");
    result.sectionKeys.forEach((sectionKey) => {
      revalidatePath(`/dashboard/intake/${sectionKey}`);
    });

    return {
      status: "success",
      message: "Strategic Intake has been submitted and locked.",
      snapshotId: result.snapshotId,
    };
  } catch (error) {
    if (isFinalSubmitIntakeError(error)) {
      return finalSubmitErrorState(error.message);
    }

    return finalSubmitErrorState(
      "Strategic Intake could not be submitted. Please try again.",
    );
  }
}
