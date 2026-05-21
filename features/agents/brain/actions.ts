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
import { logServerError } from "@/lib/logging/server";
import {
  checkRequestRateLimit,
  RATE_LIMITED_MESSAGE,
} from "@/lib/rate-limit";

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

  const rateLimit = await checkRequestRateLimit({
    bucket: "brain.run",
    identifiers: [profile.id],
    limit: 20,
    windowSeconds: 60 * 60,
  });

  if (!rateLimit.allowed) {
    return errorState(RATE_LIMITED_MESSAGE);
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

    logServerError({
      label: "[brand-brain] run failed",
      error,
      metadata: {
        profileId: profile.id,
      },
    });

    return errorState("Brand Brain could not complete this request.");
  }
}
