"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  initialPlanFormState,
  updatePlanAction,
} from "@/features/admin/plans/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} size="sm" type="submit">
      {pending ? "Saving..." : "Save"}
    </Button>
  );
}

export type PlanRowData = {
  id: string;
  name: string;
  price: number | null;
  currency: string | null;
  duration_days: number | null;
  credits: number | null;
  is_active: boolean;
};

export function PlanRow({ plan }: { plan: PlanRowData }) {
  const [state, formAction] = useActionState(
    updatePlanAction,
    initialPlanFormState,
  );

  return (
    <form
      action={formAction}
      className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-[1.4fr_0.9fr_0.6fr_0.9fr_0.9fr_auto_auto] sm:items-end"
    >
      <input name="id" type="hidden" value={plan.id} />

      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
          Name
        </span>
        <Input defaultValue={plan.name} name="name" required />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
          Price
        </span>
        <Input
          defaultValue={plan.price ?? ""}
          min="0"
          name="price"
          step="0.01"
          type="number"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
          Currency
        </span>
        <Input
          defaultValue={plan.currency ?? "USD"}
          maxLength={3}
          name="currency"
          required
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
          Duration (days)
        </span>
        <Input
          defaultValue={plan.duration_days ?? ""}
          min="1"
          name="duration_days"
          step="1"
          type="number"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
          Credits
        </span>
        <Input
          defaultValue={plan.credits ?? 0}
          min="0"
          name="credits"
          step="1"
          type="number"
        />
      </label>

      <label className="flex items-center gap-2 pb-2 text-sm">
        <input
          defaultChecked={plan.is_active}
          name="is_active"
          type="checkbox"
        />
        Active
      </label>

      <SubmitButton />

      {state.status !== "idle" ? (
        <p
          className={`col-span-full text-xs ${
            state.status === "error" ? "text-destructive" : "text-emerald-500"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
