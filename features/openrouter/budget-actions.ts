"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformOwner } from "@/features/auth/queries";
import type { BudgetFormState } from "@/features/openrouter/budget-form-state";
import { logServerError } from "@/lib/logging/server";
import { createAdminClient } from "@/lib/supabase/admin";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function setBrandBudgetAction(
  _prev: BudgetFormState,
  formData: FormData,
): Promise<BudgetFormState> {
  const { profile } = await requirePlatformOwner("/admin/ai-studio");
  const brandId = readString(formData, "brand_id");
  const dollars = readString(formData, "monthly_dollars");

  if (!brandId) {
    return { status: "error", message: "Brand is required." };
  }

  let monthlyCents: number | null;
  if (dollars === "") {
    monthlyCents = null;
  } else {
    const n = Number.parseInt(dollars, 10);
    if (!Number.isFinite(n) || n < 0) {
      return {
        status: "error",
        message: "Enter a whole-dollar cap (or leave blank for unlimited).",
      };
    }
    monthlyCents = n * 100;
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("brands")
      .update({ monthly_budget_cents: monthlyCents })
      .eq("id", brandId);
    if (error) throw error;

    revalidatePath("/admin/ai-studio");
    return {
      status: "success",
      message:
        monthlyCents === null
          ? "Cap removed — this brand is now unlimited."
          : `Cap set to $${monthlyCents / 100}.`,
    };
  } catch (error) {
    logServerError({
      label: "[admin] set brand budget failed",
      error,
      metadata: { profileId: profile.id, brandId },
    });
    return { status: "error", message: "Failed to update budget." };
  }
}
