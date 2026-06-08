"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformOwner } from "@/features/auth/queries";
import {
  brandWideAgentValue,
  validateInstruction,
} from "@/features/agents/instructions/schema";
import {
  isBrandInstructionServiceError,
  upsertBrandAgentInstruction,
} from "@/features/agents/instructions/services";
import type { InstructionFormState } from "@/features/agents/instructions/types";
import { logServerError } from "@/lib/logging/server";

const ADMIN_PATH = "/admin/agent-instructions";

function errorState(message: string): InstructionFormState {
  return { status: "error", message };
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function saveBrandAgentInstructionAction(
  _previousState: InstructionFormState,
  formData: FormData,
): Promise<InstructionFormState> {
  const { profile } = await requirePlatformOwner(ADMIN_PATH);

  const brandId = readString(formData, "brandId").trim();
  if (!brandId) {
    return errorState("Select a brand before saving.");
  }

  const rawAgent = readString(formData, "agentId").trim();
  const agentId =
    rawAgent === "" || rawAgent === brandWideAgentValue ? null : rawAgent;

  const validation = validateInstruction(readString(formData, "instruction"));
  if (validation.error) {
    return errorState(validation.error);
  }

  const isEnabled = formData.get("isEnabled") === "on";

  try {
    await upsertBrandAgentInstruction({
      profile,
      brandId,
      agentId,
      instruction: validation.instruction,
      isEnabled,
    });
  } catch (error) {
    if (isBrandInstructionServiceError(error)) {
      return errorState(error.message);
    }

    logServerError({
      label: "[brand-instruction] save failed",
      error,
      metadata: { profileId: profile.id, brandId },
    });
    return errorState("Could not save the instruction. Try again.");
  }

  revalidatePath(ADMIN_PATH);

  return {
    status: "success",
    message: agentId
      ? "Agent instruction saved."
      : "Brand-wide instruction saved.",
  };
}
