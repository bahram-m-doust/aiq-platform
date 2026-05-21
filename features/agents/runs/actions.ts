"use server";

import { revalidatePath } from "next/cache";

import { requireUserProfile } from "@/features/auth/queries";
import { catalogAgentKeyFromRoute, catalogAgentSlugForKey } from "@/features/agents/catalog/schema";
import {
  isOpenAIAgentRunConfigError,
} from "@/features/agents/runs/openai";
import {
  validateAgentRunFormData,
} from "@/features/agents/runs/schema";
import {
  isAgentRunServiceError,
  runCatalogAgent,
} from "@/features/agents/runs/services";
import type { AgentRunFormState } from "@/features/agents/runs/types";
import { logServerError } from "@/lib/logging/server";
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
  const { profile } = await requireUserProfile("/dashboard/agents");
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

  try {
    const result = await runCatalogAgent({
      profile,
      agentKey: validation.agentKey,
      prompt: validation.prompt,
    });

    revalidatePath("/dashboard/agents");
    revalidatePath(
      `/dashboard/agents/${catalogAgentSlugForKey(validation.agentKey)}`,
    );

    return {
      status: "success",
      message: "Agent response generated.",
      answer: result.answer,
      sources: result.sources,
      runId: result.runId,
      agentKey: validation.agentKey,
    };
  } catch (error) {
    if (isAgentRunServiceError(error) || isOpenAIAgentRunConfigError(error)) {
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
