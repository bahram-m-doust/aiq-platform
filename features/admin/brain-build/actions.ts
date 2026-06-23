"use server";

import { revalidatePath } from "next/cache";

import {
  buildBrainNow,
  isBrainBuildServiceError,
  scheduleBrainBuild,
} from "@/features/admin/brain-build/services";
import type { BrainBuildActionState } from "@/features/admin/brain-build/types";
import { requirePlatformOwner } from "@/features/auth/queries";
import { logServerError } from "@/lib/logging/server";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

// YYYY-MM-DD from a date input.
function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export async function scheduleBrainBuildAction(
  _previousState: BrainBuildActionState,
  formData: FormData,
): Promise<BrainBuildActionState> {
  const { profile } = await requirePlatformOwner("/admin/brands");

  const brandId = formString(formData, "brand_id");
  const targetDate = formString(formData, "target_date");

  if (!brandId) {
    return { status: "error", message: "Brand reference is missing." };
  }
  if (!isIsoDate(targetDate)) {
    return { status: "error", message: "Choose a valid target date." };
  }

  try {
    const { brandName } = await scheduleBrainBuild({
      brandId,
      targetDate,
      actor: profile,
    });
    revalidatePath("/admin/brands");
    return {
      status: "success",
      message: `Brain Build for "${brandName}" scheduled for ${targetDate}.`,
    };
  } catch (error) {
    if (isBrainBuildServiceError(error)) {
      return { status: "error", message: error.message };
    }
    logServerError({
      label: "[brain-build] schedule failed",
      error,
      metadata: { brandId, actor: profile.id },
    });
    return { status: "error", message: "Brain Build could not be scheduled." };
  }
}

export async function buildBrainNowAction(
  _previousState: BrainBuildActionState,
  formData: FormData,
): Promise<BrainBuildActionState> {
  const { profile } = await requirePlatformOwner("/admin/brands");

  const brandId = formString(formData, "brand_id");
  if (!brandId) {
    return { status: "error", message: "Brand reference is missing." };
  }

  try {
    const result = await buildBrainNow({ brandId, actor: profile });
    revalidatePath("/admin/brands");
    return {
      status: "success",
      message: `Brain built for "${result.brandName}". Synced ${result.syncedCount} document${result.syncedCount === 1 ? "" : "s"}, notified ${result.notifiedCount} member${result.notifiedCount === 1 ? "" : "s"}.`,
      builtAt: result.builtAt,
      syncedCount: result.syncedCount,
      notifiedCount: result.notifiedCount,
    };
  } catch (error) {
    if (isBrainBuildServiceError(error)) {
      return { status: "error", message: error.message };
    }
    logServerError({
      label: "[brain-build] build now failed",
      error,
      metadata: { brandId, actor: profile.id },
    });
    return { status: "error", message: "Brain could not be built." };
  }
}
