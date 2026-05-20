"use server";

import { requireUserProfile } from "@/features/auth/queries";
import { isOpenAIBrainConfigError } from "@/features/agents/brain/openai";
import {
  validateBrandBrainPromptFormData,
} from "@/features/agents/brain/schema";
import {
  isBrandBrainServiceError,
  runBrandBrain,
} from "@/features/agents/brain/services";
import type { BrandBrainChatFormState } from "@/features/agents/brain/types";

function errorState(message: string): BrandBrainChatFormState {
  return { status: "error", message };
}

export async function askBrandBrainAction(
  _previousState: BrandBrainChatFormState,
  formData: FormData,
): Promise<BrandBrainChatFormState> {
  const { profile } = await requireUserProfile("/dashboard/brain");
  const validation = validateBrandBrainPromptFormData(formData);

  if (validation.error || !validation.prompt) {
    return errorState(validation.error ?? "Brand Brain prompt is invalid.");
  }

  try {
    const result = await runBrandBrain({
      profile,
      prompt: validation.prompt,
    });

    return {
      status: "success",
      message: "Brand Brain response generated.",
      answer: result.answer,
      sources: result.sources,
      runId: result.runId,
    };
  } catch (error) {
    if (isBrandBrainServiceError(error) || isOpenAIBrainConfigError(error)) {
      return errorState(error.message);
    }

    console.error("[brand-brain] run failed", {
      profileId: profile.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return errorState("Brand Brain could not complete this request.");
  }
}
