"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformOwner } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BrandIconUploadFormState } from "@/features/admin/brand-icons/form-state";
import {
  removeBrandIcon,
  uploadBrandIcon,
} from "@/features/admin/brand-icons/storage";
import { logServerError } from "@/lib/logging/server";
import { validateSecureUpload } from "@/lib/security/file-upload";

const maxIconBytes = 2 * 1024 * 1024;

export async function uploadBrandIconAction(
  _prev: BrandIconUploadFormState,
  formData: FormData,
): Promise<BrandIconUploadFormState> {
  await requirePlatformOwner("/admin/brand-icons");

  const brandId = String(formData.get("brand_id") ?? "").trim();
  const file = formData.get("icon");

  if (!brandId) {
    return { status: "error", message: "Brand is required." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Select a PNG file to upload." };
  }
  if (file.type !== "image/png") {
    return { status: "error", message: "Only PNG files are supported." };
  }
  if (file.size > maxIconBytes) {
    return { status: "error", message: "Icon must be 2 MB or smaller." };
  }
  const validation = await validateSecureUpload({
    file,
    allowedKinds: ["PNG"],
    maxBytes: maxIconBytes,
  });
  if (!validation.ok) {
    return { status: "error", message: validation.message };
  }

  const admin = createAdminClient();
  const { data: brandRow, error: brandError } = await admin
    .from("brands")
    .select("id, icon_path")
    .eq("id", brandId)
    .maybeSingle();

  if (brandError) {
    logServerError({
      label: "[brand-icons] brand lookup failed",
      error: brandError,
      metadata: { brandId },
    });
    return { status: "error", message: "Brand could not be loaded." };
  }
  if (!brandRow) {
    return { status: "error", message: "Brand not found." };
  }

  const storagePath = `${brandId}/${crypto.randomUUID()}.png`;

  try {
    await uploadBrandIcon({ storagePath, file });
  } catch (error) {
    logServerError({
      label: "[brand-icons] upload failed",
      error,
      metadata: { brandId },
    });
    return {
      status: "error",
      message: "Icon upload failed.",
    };
  }

  const { error: updateError } = await admin
    .from("brands")
    .update({ icon_path: storagePath })
    .eq("id", brandId)
    .select("id")
    .single();

  if (updateError) {
    await removeBrandIcon(storagePath).catch(() => undefined);
    logServerError({
      label: "[brand-icons] brand update failed",
      error: updateError,
      metadata: { brandId },
    });
    return { status: "error", message: "Brand icon could not be updated." };
  }

  const previousPath = (brandRow as { icon_path: string | null }).icon_path;
  if (previousPath && previousPath !== storagePath) {
    await removeBrandIcon(previousPath).catch(() => undefined);
  }

  revalidatePath("/admin/brand-icons");
  revalidatePath("/home");

  return { status: "success", message: "Icon updated." };
}
