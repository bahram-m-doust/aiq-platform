"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformOwner } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BrandIconUploadFormState } from "@/features/admin/brand-icons/form-state";
import { uploadBrandIcon } from "@/features/admin/brand-icons/storage";

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

  const admin = createAdminClient();
  const { data: brandRow, error: brandError } = await admin
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .maybeSingle();

  if (brandError) {
    return { status: "error", message: brandError.message };
  }
  if (!brandRow) {
    return { status: "error", message: "Brand not found." };
  }

  const storagePath = `${brandId}.png`;

  try {
    await uploadBrandIcon({ storagePath, file });
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Upload failed.",
    };
  }

  const { error: updateError } = await admin
    .from("brands")
    .update({ icon_path: storagePath })
    .eq("id", brandId);

  if (updateError) {
    return { status: "error", message: updateError.message };
  }

  revalidatePath("/admin/brand-icons");
  revalidatePath("/dashboard");

  return { status: "success", message: "Icon updated." };
}
