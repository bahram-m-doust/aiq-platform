"use server";

import { revalidatePath } from "next/cache";

import { grantBrandAccess } from "@/features/access/grant-brand-access";
import { requirePlatformOwner } from "@/features/auth/queries";
import {
  validateManualGrantFormData,
} from "@/features/admin/manual-grant/schema";
import type { ManualGrantFormState } from "@/features/admin/manual-grant/types";

function errorState(message: string): ManualGrantFormState {
  return { status: "error", message };
}

function successWarning({
  includedAgentKeys,
  unmatchedAgentKeys,
}: {
  includedAgentKeys: string[];
  unmatchedAgentKeys: string[];
}) {
  if (includedAgentKeys.length === 0) {
    return "Plan granted. This plan does not currently include any agents.";
  }

  if (unmatchedAgentKeys.length > 0) {
    return `Plan granted. Some configured agents were not found: ${unmatchedAgentKeys.join(", ")}.`;
  }

  return undefined;
}

export async function createManualPlanGrantAction(
  _previousState: ManualGrantFormState,
  formData: FormData,
): Promise<ManualGrantFormState> {
  const { profile } = await requirePlatformOwner("/admin/entitlements");
  const validation = validateManualGrantFormData(formData);

  if (validation.error || !validation.data) {
    return errorState(validation.error ?? "Invalid manual grant details.");
  }

  try {
    const grant = await grantBrandAccess({
      brandId: validation.data.brandId,
      planId: validation.data.planId,
      source: validation.data.source,
      startsAt: validation.data.startsAt,
      expiresAt: validation.data.expiresAt,
      grantedByUserId: profile.id,
      actorRole: profile.global_role,
      manualReference: validation.data.manualReference,
      internalNote: validation.data.internalNote,
    });
    const warning = successWarning({
      includedAgentKeys: grant.includedAgentKeys,
      unmatchedAgentKeys: grant.unmatchedAgentKeys,
    });

    revalidatePath("/admin/entitlements");
    revalidatePath("/home");

    return {
      status: "success",
      message: "Plan grant created.",
      grant,
      ...(warning ? { warning } : {}),
    };
  } catch {
    return errorState("Plan grant could not be created.");
  }
}
