"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformOwner } from "@/features/auth/queries";
import {
  deleteBrandApiKey,
  setBrandApiKey,
} from "@/features/brands/api-keys";
import { clearBrandClientCache } from "@/lib/openrouter/client";
import type { ApiKeyFormState } from "@/features/brands/api-key-form-state";
import { logServerError } from "@/lib/logging/server";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

// The encryption keyring throws a recognizable message when KEY_ENCRYPTION_KEY /
// KEY_ENCRYPTION_KEYS is unset or malformed. Surface that as a config hint
// rather than a generic "failed to save" so the operator knows where to look.
function isEncryptionConfigError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return (
    message.includes("KEY_ENCRYPTION_KEY") ||
    message.includes("KEY_ENCRYPTION_KEYS") ||
    message.includes("encryption key") ||
    message.includes("Active encryption key")
  );
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
    return {
      status: "error",
      message: isEncryptionConfigError(error)
        ? "Server can't encrypt keys — KEY_ENCRYPTION_KEY is missing or invalid. Set it to a base64-encoded 32-byte value and restart."
        : "Failed to save API key.",
    };
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
