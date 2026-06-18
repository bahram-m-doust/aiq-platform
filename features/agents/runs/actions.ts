"use server";

import { revalidatePath } from "next/cache";

import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import { requireUserProfile } from "@/features/auth/queries";
import { catalogAgentKeyFromRoute, catalogAgentSlugForKey } from "@/features/agents/catalog/schema";
import { createAgentImageSignedUrls } from "@/features/agents/runs/image-storage";
import {
  isLLMAgentRunConfigError,
} from "@/features/agents/runs/llm";
import {
  filterOwnedAgentImagePaths,
  validateAgentRunFormData,
} from "@/features/agents/runs/schema";
import {
  isAgentRunServiceError,
  runCatalogAgent,
} from "@/features/agents/runs/services";
import type { AgentRunFormState } from "@/features/agents/runs/types";
import { isBudgetExceededError } from "@/features/openrouter/usage";
import { logServerError } from "@/lib/logging/server";
import {
  coerceImageModel,
  coerceTextModel,
  isImageModelId,
  isTextModelId,
} from "@/lib/openrouter/models";
import {
  checkRequestRateLimit,
  RATE_LIMITED_MESSAGE,
} from "@/lib/rate-limit";

function errorState(message: string): AgentRunFormState {
  return { status: "error", message };
}

export async function runAgentAction(
  _previousState: AgentRunFormState,
  formData: FormData,
): Promise<AgentRunFormState> {
  const { profile } = await requireUserProfile("/agents");
  const validation = validateAgentRunFormData(formData, catalogAgentKeyFromRoute);

  if (validation.error || !validation.agentKey || !validation.prompt) {
    return errorState(validation.error ?? "Agent run request is invalid.");
  }

  const rateLimit = await checkRequestRateLimit({
    bucket: "agent.run",
    identifiers: [profile.id, validation.agentKey],
    limit: 20,
    windowSeconds: 60 * 60,
  });

  if (!rateLimit.allowed) {
    return errorState(RATE_LIMITED_MESSAGE);
  }

  const rawTextModel = formData.get("text_model");
  const rawImageModel = formData.get("image_model");
  const textModelOverride = isTextModelId(rawTextModel)
    ? coerceTextModel(rawTextModel)
    : null;
  const imageModelOverride = isImageModelId(rawImageModel)
    ? coerceImageModel(rawImageModel)
    : null;

  try {
    const result = await runCatalogAgent({
      profile,
      agentKey: validation.agentKey,
      prompt: validation.prompt,
      textModelOverride,
      imageModelOverride,
    });

    revalidatePath("/agents");
    revalidatePath(
      `/agents/${catalogAgentSlugForKey(validation.agentKey)}`,
    );

    return {
      status: "success",
      message: "Agent response generated.",
      answer: result.answer,
      sources: result.sources,
      runId: result.runId,
      agentKey: validation.agentKey,
      imagePaths: result.imagePaths,
    };
  } catch (error) {
    if (
      isBudgetExceededError(error) ||
      isAgentRunServiceError(error) ||
      isLLMAgentRunConfigError(error)
    ) {
      return errorState(error.message);
    }

    logServerError({
      label: "[agent-runs] run failed",
      error,
      metadata: {
        agentKey: validation.agentKey,
        profileId: profile.id,
      },
    });

    return errorState("The agent could not complete this request.");
  }
}

export async function resolveAgentImageUrlsAction(
  imagePaths: string[],
): Promise<string[]> {
  if (!Array.isArray(imagePaths) || imagePaths.length === 0) return [];
  const { profile } = await requireUserProfile("/agents");

  // Sign only image paths that belong to the caller's own brand — the path's
  // first segment is the owning brand. Otherwise any authenticated user could
  // mint signed URLs for another brand's private images by passing arbitrary
  // paths (cross-tenant IDOR). See filterOwnedAgentImagePaths.
  const access = await getBrandAccessSummaryForProfile(profile.id);
  const ownedPaths = filterOwnedAgentImagePaths(imagePaths, access.brandId);

  if (ownedPaths.length === 0) return [];

  try {
    return await createAgentImageSignedUrls(ownedPaths);
  } catch (error) {
    logServerError({
      label: "[agent-runs] resolve image urls failed",
      error,
      metadata: { profileId: profile.id, brandId: access.brandId },
    });
    return [];
  }
}
