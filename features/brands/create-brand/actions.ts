"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { validateCreateBrandFormData } from "@/features/brands/create-brand/schema";
import { createBrandFromCreateBrandAccessKey } from "@/features/brands/create-brand/services";
import type { CreateBrandFormState } from "@/features/brands/create-brand/types";
import { requireUserProfile } from "@/features/auth/queries";

function errorState(message: string): CreateBrandFormState {
  return { status: "error", message };
}

export async function createBrandFromAccessKeyAction(
  _previousState: CreateBrandFormState,
  formData: FormData,
): Promise<CreateBrandFormState> {
  const { profile } = await requireUserProfile("/create-brand");
  const validation = validateCreateBrandFormData(formData);

  if (validation.error || !validation.data) {
    return errorState(validation.error ?? "Invalid brand details.");
  }

  try {
    await createBrandFromCreateBrandAccessKey({
      accessKeyId: validation.data.accessKeyId,
      brandName: validation.data.brandName,
      industry: validation.data.industry,
      website: validation.data.website,
      userId: profile.id,
      userEmail: profile.email,
      actorRole: profile.global_role,
    });
  } catch {
    return errorState("Brand workspace could not be created.");
  }

  revalidatePath("/home");
  redirect("/home");
}
