"use server";

import { revalidatePath } from "next/cache";

import {
  catalogAgentSlugForKey,
  validateAgentActivationFormData,
} from "@/features/agents/catalog/schema";
import {
  activateCatalogAgent,
  isAgentActivationServiceError,
} from "@/features/agents/catalog/services";
import type { AgentActivationFormState } from "@/features/agents/catalog/types";
import { requireUserProfile } from "@/features/auth/queries";
import { logServerError } from "@/lib/logging/server";
import {
  checkRequestRateLimit,
  RATE_LIMITED_MESSAGE,
} from "@/lib/rate-limit";

function errorState(message: string): AgentActivationFormState {
  return { status: "error", message };
}

export async function activateAgentAction(
  _previousState: AgentActivationFormState,
  formData: FormData,
): Promise<AgentActivationFormState> {
  const { profile } = await requireUserProfile("/dashboard/agents");
  const validation = validateAgentActivationFormData(formData);

  if (validation.error || !validation.agentKey) {
    return errorState(validation.error ?? "Agent activation request is invalid.");
  }

  const rateLimit = await checkRequestRateLimit({
    bucket: "agent.activate",
    identifiers: [profile.id, validation.agentKey],
    limit: 20,
    windowSeconds: 60 * 60,
  });

  if (!rateLimit.allowed) {
    return errorState(RATE_LIMITED_MESSAGE);
  }

  try {
    const result = await activateCatalogAgent({
      profile,
      agentKey: validation.agentKey,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/agents");
    revalidatePath(
      `/dashboard/agents/${catalogAgentSlugForKey(validation.agentKey)}`,
    );

    return {
      status: "success",
      message: result.message,
      agentKey: result.agentKey,
    };
  } catch (error) {
    if (isAgentActivationServiceError(error)) {
      return errorState(error.message);
    }

    logServerError({
      label: "[agent-catalog] activation failed",
      error,
      metadata: {
        agentKey: validation.agentKey,
        profileId: profile.id,
      },
    });

    return errorState("Agent activation could not be completed.");
  }
}
