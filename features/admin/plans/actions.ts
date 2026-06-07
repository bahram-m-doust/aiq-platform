"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformOwner } from "@/features/auth/queries";
import type { PlanFormState } from "@/features/admin/plans/form-state";
import { createAdminClient } from "@/lib/supabase/admin";

function parseCommonFields(formData: FormData):
  | { ok: true; values: {
      name: string;
      price: number | null;
      currency: string;
      duration_days: number | null;
      credits: number;
      is_active: boolean;
    } }
  | { ok: false; message: string } {
  const name = String(formData.get("name") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();
  const currency = String(formData.get("currency") ?? "USD").trim().toUpperCase();
  const durationRaw = String(formData.get("duration_days") ?? "").trim();
  const creditsRaw = String(formData.get("credits") ?? "").trim();
  const is_active = formData.get("is_active") === "on";

  if (!name) return { ok: false, message: "Name is required." };
  if (name.length > 64) return { ok: false, message: "Name must be 64 characters or fewer." };
  if (currency.length !== 3) return { ok: false, message: "Currency must be a 3-letter code (e.g. USD)." };

  let price: number | null = null;
  if (priceRaw) {
    const parsed = Number(priceRaw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { ok: false, message: "Price must be a non-negative number." };
    }
    price = parsed;
  }

  let duration_days: number | null = null;
  if (durationRaw) {
    const parsed = Number(durationRaw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { ok: false, message: "Duration must be a positive whole number of days." };
    }
    duration_days = parsed;
  }

  let credits = 0;
  if (creditsRaw) {
    const parsed = Number(creditsRaw);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return { ok: false, message: "Credits must be a non-negative whole number." };
    }
    credits = parsed;
  }

  return { ok: true, values: { name, price, currency, duration_days, credits, is_active } };
}

export async function createPlanAction(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  await requirePlatformOwner("/admin/plans");

  const parsed = parseCommonFields(formData);
  if (!parsed.ok) return { status: "error", message: parsed.message };

  const admin = createAdminClient();
  const { error } = await admin.from("plans").insert(parsed.values);

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "A plan with that name already exists." };
    }
    return { status: "error", message: error.message };
  }

  revalidatePath("/admin/plans");
  return { status: "success", message: `Plan "${parsed.values.name}" created.` };
}

export async function updatePlanAction(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  await requirePlatformOwner("/admin/plans");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { status: "error", message: "Plan id is required." };

  const parsed = parseCommonFields(formData);
  if (!parsed.ok) return { status: "error", message: parsed.message };

  const admin = createAdminClient();
  const { error } = await admin
    .from("plans")
    .update(parsed.values)
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "A plan with that name already exists." };
    }
    return { status: "error", message: error.message };
  }

  revalidatePath("/admin/plans");
  return { status: "success", message: "Plan updated." };
}
