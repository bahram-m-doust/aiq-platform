"use server";

import { revalidatePath } from "next/cache";

import {
  catalogAgentSlugForKey,
  initialAgentActivationFormState,
  validateAgentActivationFormData,
} from "@/features/agents/catalog/schema";
import {
  activateCatalogAgent,
  isAgentActivationServiceError,
} from "@/features/agents/catalog/services";
import type { AgentActivationFormState } from "@/features/agents/catalog/types";
import { requireUserProfile } from "@/features/auth/queries";

export { initialAgentActivationFormState };

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

    console.error("[agent-catalog] activation failed", {
      agentKey: validation.agentKey,
      profileId: profile.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return errorState("Agent activation could not be completed.");
  }
}
