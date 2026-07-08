"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setBrandBudgetAction } from "@/features/openrouter/budget-actions";
import { initialBudgetFormState } from "@/features/openrouter/budget-form-state";

function shortProviderId(providerVectorStoreId: string | null) {
  if (!providerVectorStoreId) return "Not created";
  if (providerVectorStoreId.length <= 18) return providerVectorStoreId;
  return `${providerVectorStoreId.slice(0, 10)}...${providerVectorStoreId.slice(-6)}`;
}
function BudgetForm({
  brandId,
  initialDollars,
}: {
  brandId: string;
  initialDollars: number | "";
}) {
  const [state, formAction] = useActionState(
    setBrandBudgetAction,
    initialBudgetFormState,
  );
  const [value, setValue] = useState<number | "">(initialDollars);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input name="brand_id" type="hidden" value={brandId} />
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground">$</span>
        <Input
          className="w-24"
          inputMode="numeric"
          min={0}
          name="monthly_dollars"
          onChange={(e) =>
            setValue(e.target.value === "" ? "" : Number(e.target.value))
          }
          placeholder="-"
          type="number"
          value={value}
        />
        <span className="text-sm text-muted-foreground">/ month</span>
      </div>
      <SubmitChip label="Save cap" pendingLabel="Saving..." />
      {state.status === "error" ? (
        <p className="basis-full text-xs text-destructive">{state.message}</p>
      ) : null}
      {state.status === "success" ? (
        <p className="basis-full text-xs text-emerald-500">{state.message}</p>
      ) : null}
    </form>
  );
}

function SubmitChip({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} size="sm" type="submit">
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function AdminBrandRow({
  brandId,
  brandName,
  hasGlobalOpenAIKey,
  monthlyBudgetCents,
  monthSpendCents,
  providerVectorStoreId,
  knowledgeBaseStatus,
  eligibleCount,
  syncingCount,
  syncedCount,
  failedCount,
}: {
  brandId: string;
  brandName: string;
  hasGlobalOpenAIKey: boolean;
  monthlyBudgetCents: number | null;
  monthSpendCents: number;
  providerVectorStoreId: string | null;
  knowledgeBaseStatus: string;
  eligibleCount: number;
  syncingCount: number;
  syncedCount: number;
  failedCount: number;
}) {
  const dollars: number | "" =
    monthlyBudgetCents !== null && monthlyBudgetCents >= 0
      ? Math.round(monthlyBudgetCents / 100)
      : "";

  const cap = monthlyBudgetCents;
  const overCap = cap !== null && monthSpendCents >= cap;
  const pct = cap && cap > 0 ? Math.min(100, (monthSpendCents / cap) * 100) : 0;

  return (
    <Alert className="space-y-4 border border-border bg-card text-card-foreground">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{brandName}</p>
          <p className="font-mono text-[10px] text-muted-foreground">
            {brandId}
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          OpenAI key:{" "}
          <span
            className={
              hasGlobalOpenAIKey ? "text-emerald-500" : "text-amber-500"
            }
          >
            {hasGlobalOpenAIKey ? "Configured globally" : "Missing"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            OpenAI File Search
          </p>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Vector store</span>
              <span className="font-mono text-xs">
                {shortProviderId(providerVectorStoreId)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Knowledge status</span>
              <span className="font-mono text-xs">{knowledgeBaseStatus}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-2 text-center text-xs">
              <div className="rounded-md border border-border p-2">
                <div className="font-mono">{eligibleCount}</div>
                <div className="text-muted-foreground">Ready</div>
              </div>
              <div className="rounded-md border border-border p-2">
                <div className="font-mono">{syncingCount}</div>
                <div className="text-muted-foreground">Syncing</div>
              </div>
              <div className="rounded-md border border-border p-2">
                <div className="font-mono">{syncedCount}</div>
                <div className="text-muted-foreground">Synced</div>
              </div>
              <div className="rounded-md border border-border p-2">
                <div className="font-mono">{failedCount}</div>
                <div className="text-muted-foreground">Failed</div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Monthly cap
          </p>
          <BudgetForm brandId={brandId} initialDollars={dollars} />
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">This month</span>
              <span
                className={`font-mono ${overCap ? "text-destructive" : ""}`}
              >
                ${(monthSpendCents / 100).toFixed(2)}
                {cap !== null ? ` / $${(cap / 100).toFixed(2)}` : ""}
              </span>
            </div>
            {cap !== null ? (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: overCap
                      ? "var(--destructive)"
                      : "var(--bv-brand-mid)",
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <AlertDescription className="sr-only">
        Manage OpenAI File Search status and AI budget for {brandName}.
      </AlertDescription>
    </Alert>
  );
}
