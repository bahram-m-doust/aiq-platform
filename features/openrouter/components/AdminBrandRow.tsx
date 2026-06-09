"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminDeleteBrandApiKeyAction,
  adminSetBrandApiKeyAction,
} from "@/features/brands/api-key-actions";
import { initialApiKeyFormState } from "@/features/brands/api-key-form-state";
import { setBrandBudgetAction } from "@/features/openrouter/budget-actions";
import { initialBudgetFormState } from "@/features/openrouter/budget-form-state";

function ApiKeyForm({ brandId }: { brandId: string }) {
  const [state, formAction] = useActionState(
    adminSetBrandApiKeyAction,
    initialApiKeyFormState,
  );
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input name="brand_id" type="hidden" value={brandId} />
      <Input
        className="max-w-xs"
        name="api_key"
        placeholder="sk-or-v1-..."
        required
        type="password"
      />
      <SubmitChip label="Save key" pendingLabel="Saving..." />
      {state.status === "error" ? (
        <p className="basis-full text-xs text-destructive">{state.message}</p>
      ) : null}
      {state.status === "success" ? (
        <p className="basis-full text-xs text-emerald-500">{state.message}</p>
      ) : null}
    </form>
  );
}

function DeleteKeyForm({ brandId }: { brandId: string }) {
  const [state, formAction] = useActionState(
    adminDeleteBrandApiKeyAction,
    initialApiKeyFormState,
  );
  return (
    <form action={formAction}>
      <input name="brand_id" type="hidden" value={brandId} />
      <Button size="sm" type="submit" variant="outline">
        Remove key
      </Button>
      {state.status === "error" ? (
        <p className="mt-1 text-xs text-destructive">{state.message}</p>
      ) : null}
      {state.status === "success" ? (
        <p className="mt-1 text-xs text-emerald-500">{state.message}</p>
      ) : null}
    </form>
  );
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
          placeholder="—"
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
  hasKey,
  monthlyBudgetCents,
  monthSpendCents,
}: {
  brandId: string;
  brandName: string;
  hasKey: boolean;
  monthlyBudgetCents: number | null;
  monthSpendCents: number;
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
          Key:{" "}
          <span className={hasKey ? "text-emerald-500" : "text-amber-500"}>
            {hasKey ? "Active" : "Using global"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            API Key
          </p>
          <ApiKeyForm brandId={brandId} />
          {hasKey ? <DeleteKeyForm brandId={brandId} /> : null}
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
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
              >
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
        Manage OpenRouter access for {brandName}.
      </AlertDescription>
    </Alert>
  );
}
