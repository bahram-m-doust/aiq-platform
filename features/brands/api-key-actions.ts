"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformOwner } from "@/features/auth/queries";
import {
  deleteBrandApiKey,
  setBrandApiKey,
} from "@/features/brands/api-keys";
import { clearBrandClientCache } from "@/lib/openrouter/client";
import { logServerError } from "@/lib/logging/server";

type ApiKeyFormState =
  | { status: "idle"; message: string }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export const initialApiKeyFormState: ApiKeyFormState = {
  status: "idle",
  message: "",
};

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function adminSetBrandApiKeyAction(
  _prev: ApiKeyFormState,
  formData: FormData,
): Promise<ApiKeyFormState> {
  const { profile } = await requirePlatformOwner("/admin/documents");
  const brandId = readString(formData, "brand_id");
  const apiKey = readString(formData, "api_key");

  if (!brandId) {
    return { status: "error", message: "Brand is required." };
  }

  if (!apiKey) {
    return { status: "error", message: "API key is required." };
  }

  if (!apiKey.startsWith("sk-")) {
    return { status: "error", message: "API key should start with sk-." };
  }

  try {
    await setBrandApiKey({
      brandId,
      apiKey,
      actorId: profile.id,
    });
    clearBrandClientCache(brandId);
    revalidatePath("/admin/documents");
    return { status: "success", message: "API key saved for this brand." };
  } catch (error) {
    logServerError({
      label: "[admin] set brand API key failed",
      error,
      metadata: { profileId: profile.id, brandId },
    });
    return { status: "error", message: "Failed to save API key." };
  }
}

export async function adminDeleteBrandApiKeyAction(
  _prev: ApiKeyFormState,
  formData: FormData,
): Promise<ApiKeyFormState> {
  const { profile } = await requirePlatformOwner("/admin/documents");
  const brandId = readString(formData, "brand_id");

  if (!brandId) {
    return { status: "error", message: "Brand is required." };
  }

  try {
    await deleteBrandApiKey({ brandId, actorId: profile.id });
    clearBrandClientCache(brandId);
    revalidatePath("/admin/documents");
    return { status: "success", message: "Brand API key removed. Using global key." };
  } catch (error) {
    logServerError({
      label: "[admin] delete brand API key failed",
      error,
      metadata: { profileId: profile.id, brandId },
    });
    return { status: "error", message: "Failed to remove API key." };
  }
}
