"use server";

import { requireUserProfile } from "@/features/auth/queries";
import { isLLMBrainConfigError } from "@/features/agents/brain/llm";
import { getBrainSessionConversation } from "@/features/agents/brain/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isBrandBrainImageServiceError,
  runBrandBrainImage,
} from "@/features/agents/brain/image";
import {
  parseBrandBrainHistory,
  validateBrandBrainPrompt,
  validateBrandBrainPromptFormData,
} from "@/features/agents/brain/schema";
import {
  isBrandBrainServiceError,
  runBrandBrain,
} from "@/features/agents/brain/services";
import type {
  BrandBrainChatFormState,
  BrandBrainImageState,
} from "@/features/agents/brain/types";
import { isBudgetExceededError } from "@/features/openrouter/usage";
import { logServerError } from "@/lib/logging/server";
import {
  checkRequestRateLimit,
  RATE_LIMITED_MESSAGE,
} from "@/lib/rate-limit";
import { ROUTES } from "@/lib/routes";

function errorState(message: string): BrandBrainChatFormState {
  return { status: "error", message };
}

// Delete all agent_runs that belong to a chat session. When isSession is false
// the id is a single run id (legacy run before session support was added).
export async function deleteBrainSessionAction(
  id: string,
  isSession: boolean,
): Promise<{ error?: string }> {
  try {
    const { profile } = await requireUserProfile(ROUTES.brain);
    const admin = createAdminClient();

    const query = admin
      .from("agent_runs")
      .delete()
      .eq("user_id", profile.id);

    const { error } = isSession
      ? await query.eq("session_id", id)
      : await query.eq("id", id);

    if (error) throw error;
    return {};
  } catch {
    return { error: "Could not delete this chat session." };
  }
}

export async function loadBrainSessionAction(
  sessionId: string,
  isSession: boolean,
): Promise<{ messages?: import("@/features/agents/brain/types").BrandBrainConversationMessage[]; error?: string }> {
  try {
    const { profile } = await requireUserProfile(ROUTES.brain);
    const messages = await getBrainSessionConversation({
      sessionId,
      userId: profile.id,
      isSession,
    });
    return { messages };
  } catch {
    return { error: "Could not load this session." };
  }
}

export async function askBrandBrainAction(
  _previousState: BrandBrainChatFormState,
  formData: FormData,
): Promise<BrandBrainChatFormState> {
  const { profile } = await requireUserProfile(ROUTES.brain);
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

  const history = parseBrandBrainHistory(formData);

  try {
    const result = await runBrandBrain({
      profile,
      prompt: validation.prompt,
      history,
    });

    return {
      status: "success",
      message: "Brand Brain response generated.",
      answer: result.answer,
      sources: result.sources,
      runId: result.runId,
    };
  } catch (error) {
    if (
      isBudgetExceededError(error) ||
      isBrandBrainServiceError(error) ||
      isLLMBrainConfigError(error)
    ) {
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

// Image mode. Called imperatively from the chat client (not a form action) and
// returns the generated images in one shot — image generation does not stream.
export async function generateBrandBrainImageAction(
  prompt: string,
): Promise<BrandBrainImageState> {
  const { profile } = await requireUserProfile(ROUTES.brain);
  const validation = validateBrandBrainPrompt(prompt);

  if (validation.error || !validation.prompt) {
    return {
      status: "error",
      message: validation.error ?? "Brand Brain prompt is invalid.",
    };
  }

  // Images are pricier than text, so they get a tighter hourly bucket.
  const rateLimit = await checkRequestRateLimit({
    bucket: "brain.image",
    identifiers: [profile.id],
    limit: 10,
    windowSeconds: 60 * 60,
  });

  if (!rateLimit.allowed) {
    return { status: "error", message: RATE_LIMITED_MESSAGE };
  }

  try {
    const result = await runBrandBrainImage({
      profile,
      prompt: validation.prompt,
    });

    return {
      status: "success",
      runId: result.runId,
      images: result.images,
      imagePrompt: result.optimizedPrompt,
      sources: result.sources,
    };
  } catch (error) {
    if (
      isBudgetExceededError(error) ||
      isBrandBrainImageServiceError(error) ||
      isLLMBrainConfigError(error)
    ) {
      return { status: "error", message: error.message };
    }

    logServerError({
      label: "[brand-brain] image run failed",
      error,
      metadata: { profileId: profile.id },
    });

    return {
      status: "error",
      message: "Brand Brain could not generate an image.",
    };
  }
}
