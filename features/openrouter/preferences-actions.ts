"use server";

import { revalidatePath } from "next/cache";

import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import { requireUserProfile } from "@/features/auth/queries";
import {
  coerceImageModel,
  coerceTextModel,
  isImageModelId,
  isTextModelId,
} from "@/lib/openrouter/models";
import { logServerError } from "@/lib/logging/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ModelPrefFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialModelPrefFormState: ModelPrefFormState = {
  status: "idle",
  message: "",
};

async function getActiveOwnerBrand(profileId: string) {
  const summary = await getBrandAccessSummaryForProfile(profileId);
  if (summary.status !== "ACTIVE_ACCESS" || !summary.brandId) {
    throw new Error("Active brand access required.");
  }
  if (summary.membershipRole !== "OWNER") {
    throw new Error("Only the brand owner can change OpenRouter defaults.");
  }
  return summary.brandId;
}

export async function setDefaultTextModelAction(
  _prev: ModelPrefFormState,
  formData: FormData,
): Promise<ModelPrefFormState> {
  const { profile } = await requireUserProfile("/dashboard/openrouter");
  const raw = formData.get("text_model");

  if (!isTextModelId(raw)) {
    return { status: "error", message: "Pick a valid text model." };
  }

  try {
    const brandId = await getActiveOwnerBrand(profile.id);
    const admin = createAdminClient();
    const { error } = await admin
      .from("brands")
      .update({ default_text_model: coerceTextModel(raw) })
      .eq("id", brandId);
    if (error) throw error;
    revalidatePath("/dashboard/openrouter");
    return { status: "success", message: "Default text model updated." };
  } catch (error) {
    logServerError({
      label: "[openrouter] set default text model failed",
      error,
      metadata: { profileId: profile.id },
    });
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Failed to update text model.",
    };
  }
}

export async function setDefaultImageModelAction(
  _prev: ModelPrefFormState,
  formData: FormData,
): Promise<ModelPrefFormState> {
  const { profile } = await requireUserProfile("/dashboard/openrouter");
  const raw = formData.get("image_model");

  if (!isImageModelId(raw)) {
    return { status: "error", message: "Pick a valid image model." };
  }

  try {
    const brandId = await getActiveOwnerBrand(profile.id);
    const admin = createAdminClient();
    const { error } = await admin
      .from("brands")
      .update({ default_image_model: coerceImageModel(raw) })
      .eq("id", brandId);
    if (error) throw error;
    revalidatePath("/dashboard/openrouter");
    return { status: "success", message: "Default image model updated." };
  } catch (error) {
    logServerError({
      label: "[openrouter] set default image model failed",
      error,
      metadata: { profileId: profile.id },
    });
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to update image model.",
    };
  }
}
