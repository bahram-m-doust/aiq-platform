import "server-only";

import {
  DomainError,
  isDomainErrorWithCode,
  wrapSupabaseError,
} from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

const BUDGET_ERROR_CODE = "openrouter_budget_exceeded";

export function isBudgetExceededError(error: unknown): error is DomainError {
  return isDomainErrorWithCode(error, BUDGET_ERROR_CODE);
}

export type UsageKind = "TEXT" | "IMAGE" | "EMBEDDING";

export type UsageReservation = {
  id: string;
  brandId: string;
  kind: UsageKind;
};

const reservationCents: Record<UsageKind, number> = {
  TEXT: 25,
  IMAGE: 100,
  EMBEDDING: 5,
};

export async function reserveRunUsage({
  brandId,
  kind,
}: {
  brandId: string;
  kind: UsageKind;
}): Promise<UsageReservation> {
  const admin = createAdminClient();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const { data, error } = await admin.rpc("reserve_ai_budget", {
    p_brand_id: brandId,
    p_kind: kind,
    p_reserved_cents: reservationCents[kind],
    p_expires_at: expiresAt,
  });

  if (error) {
    if (error.message?.includes("AI_BUDGET_EXCEEDED")) {
      throw new DomainError(
        BUDGET_ERROR_CODE,
        "Monthly OpenRouter budget reached. Ask your admin to top up before generating more.",
      );
    }
    throw wrapSupabaseError(error, "reserve_ai_budget failed");
  }

  if (typeof data !== "string" || !data) {
    throw new DomainError("openrouter_budget_reservation", "AI budget reservation failed.");
  }

  return { id: data, brandId, kind };
}

export async function releaseRunUsageReservation(
  reservation: UsageReservation,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("release_ai_budget_reservation", {
    p_reservation_id: reservation.id,
  });
  if (error) {
    throw wrapSupabaseError(error, "release_ai_budget_reservation failed");
  }
}

export async function withRunUsageReservation<T>({
  brandId,
  kind,
  operation,
}: {
  brandId: string;
  kind: UsageKind;
  operation: (reservation: UsageReservation) => Promise<T>;
}): Promise<T> {
  const reservation = await reserveRunUsage({ brandId, kind });
  try {
    return await operation(reservation);
  } catch (error) {
    await releaseRunUsageReservation(reservation).catch(() => undefined);
    throw error;
  }
}

export async function recordRunUsage({
  reservation,
  kind,
  model,
  promptTokens,
  completionTokens,
  imageCount,
  costCents,
}: {
  reservation: UsageReservation;
  kind: UsageKind;
  model: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  imageCount?: number | null;
  costCents: number;
}): Promise<string> {
  if (reservation.kind !== kind) {
    throw new DomainError(
      "openrouter_usage_kind_mismatch",
      "AI usage kind does not match its reservation.",
    );
  }

  const admin = createAdminClient();
  const safeCost = Number.isFinite(costCents) ? Math.max(0, costCents) : 0;

  const { data, error: usageError } = await admin.rpc("settle_ai_usage", {
    p_reservation_id: reservation.id,
    p_model: model,
    p_prompt_tokens: promptTokens ?? null,
    p_completion_tokens: completionTokens ?? null,
    p_image_count: imageCount ?? null,
    p_cost_cents: safeCost,
  });
  if (usageError) {
    throw wrapSupabaseError(usageError, "settle_ai_usage failed");
  }

  if (typeof data !== "string" || !data) {
    throw new DomainError("openrouter_usage_settlement", "AI usage settlement failed.");
  }

  return data;
}

export async function attachRunUsage({
  runId,
  usageIds,
}: {
  runId: string;
  usageIds: string[];
}): Promise<void> {
  if (usageIds.length === 0) return;
  const admin = createAdminClient();
  const { error } = await admin.rpc("attach_ai_usage_to_run", {
    p_run_id: runId,
    p_usage_ids: usageIds,
  });
  if (error) {
    throw wrapSupabaseError(error, "attach_ai_usage_to_run failed");
  }
}

function firstOfMonthUtc(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

// Reporting only. Budget enforcement uses reserve_ai_budget, which locks the
// brand row and accounts for concurrent reservations transactionally.
export async function getBrandAiBudgetSummary(brandId: string): Promise<{
  monthlyBudgetCents: number | null;
  spentCents: number;
  remainingCents: number | null;
}> {
  const admin = createAdminClient();
  const { data: brandRow, error: brandError } = await admin
    .from("brands")
    .select("monthly_budget_cents")
    .eq("id", brandId)
    .maybeSingle<{ monthly_budget_cents: number | null }>();

  if (brandError) throw wrapSupabaseError(brandError, "getBrandAiBudgetSummary brand fetch failed");

  const monthlyBudgetCents = brandRow?.monthly_budget_cents ?? null;
  const spentCents = await getMonthSpendCents(brandId);
  const remainingCents =
    monthlyBudgetCents !== null
      ? Math.max(0, monthlyBudgetCents - spentCents)
      : null;

  return { monthlyBudgetCents, spentCents, remainingCents };
}

export async function getMonthSpendCents(brandId: string): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agent_run_usage")
    .select("cost_cents")
    .eq("brand_id", brandId)
    .gte("created_at", firstOfMonthUtc());

  if (error) {
    throw wrapSupabaseError(error, "getMonthSpendCents failed");
  }

  return ((data ?? []) as { cost_cents: number | string }[]).reduce(
    (total, row) => {
      const value = Number(row.cost_cents);
      return Number.isFinite(value) ? total + value : total;
    },
    0,
  );
}

export type MonthUsageRow = {
  id: string;
  kind: UsageKind;
  model: string;
  costCents: number;
  promptTokens: number | null;
  completionTokens: number | null;
  imageCount: number | null;
  createdAt: string;
};

export async function getRecentMonthUsageRows(
  brandId: string,
  limit = 5,
): Promise<MonthUsageRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agent_run_usage")
    .select(
      "id, kind, model, cost_cents, prompt_tokens, completion_tokens, image_count, created_at",
    )
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw wrapSupabaseError(error, "getRecentMonthUsageRows failed");
  }

  return ((data ?? []) as Array<{
    id: string;
    kind: UsageKind;
    model: string;
    cost_cents: number | string;
    prompt_tokens: number | null;
    completion_tokens: number | null;
    image_count: number | null;
    created_at: string;
  }>).map((row) => ({
    id: row.id,
    kind: row.kind,
    model: row.model,
    costCents:
      typeof row.cost_cents === "string"
        ? Number.parseFloat(row.cost_cents)
        : row.cost_cents,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    imageCount: row.image_count,
    createdAt: row.created_at,
  }));
}
