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

export async function recordRunUsage({
  runId,
  brandId,
  kind,
  model,
  promptTokens,
  completionTokens,
  imageCount,
  costCents,
}: {
  runId: string | null;
  brandId: string;
  kind: UsageKind;
  model: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  imageCount?: number | null;
  costCents: number;
}) {
  const admin = createAdminClient();
  const safeCost = Number.isFinite(costCents) ? Math.max(0, costCents) : 0;

  const { error: usageError } = await admin.from("agent_run_usage").insert({
    run_id: runId,
    brand_id: brandId,
    kind,
    model,
    prompt_tokens: promptTokens ?? null,
    completion_tokens: completionTokens ?? null,
    image_count: imageCount ?? null,
    cost_cents: safeCost,
  });
  if (usageError) {
    throw wrapSupabaseError(usageError, "agent_run_usage.insert failed");
  }

  if (runId) {
    await admin
      .from("agent_runs")
      .update({ cost: safeCost / 100 })
      .eq("id", runId);
  }
}

function firstOfMonthUtc(now = new Date()): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  return d.toISOString();
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

  let total = 0;
  for (const row of (data ?? []) as { cost_cents: number | string }[]) {
    const n =
      typeof row.cost_cents === "string"
        ? Number.parseFloat(row.cost_cents)
        : row.cost_cents;
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

export async function getBrandBudgetCents(
  brandId: string,
): Promise<number | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brands")
    .select("monthly_budget_cents")
    .eq("id", brandId)
    .maybeSingle<{ monthly_budget_cents: number | null }>();
  if (error) {
    throw wrapSupabaseError(error, "getBrandBudgetCents failed");
  }
  return data?.monthly_budget_cents ?? null;
}

export async function assertWithinBudget(brandId: string): Promise<void> {
  const budget = await getBrandBudgetCents(brandId);
  if (budget === null) return;
  const spent = await getMonthSpendCents(brandId);
  if (spent >= budget) {
    throw new DomainError(
      BUDGET_ERROR_CODE,
      "Monthly OpenRouter budget reached. Ask your admin to top up before generating more.",
    );
  }
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
