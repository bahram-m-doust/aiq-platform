"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPlanAction } from "@/features/admin/plans/actions";
import { initialPlanFormState } from "@/features/admin/plans/form-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} type="submit">
      {pending ? "Creating..." : "Create plan"}
    </Button>
  );
}

export function CreatePlanForm() {
  const [state, formAction] = useActionState(
    createPlanAction,
    initialPlanFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      action={formAction}
      className="grid gap-3 sm:grid-cols-[1.4fr_0.9fr_0.6fr_0.9fr_0.9fr_auto_auto] sm:items-end"
      ref={formRef}
    >
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
          Name
        </span>
        <Input name="name" placeholder="STARTER" required />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
          Price
        </span>
        <Input min="0" name="price" placeholder="49" step="0.01" type="number" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
          Currency
        </span>
        <Input
          defaultValue="USD"
          maxLength={3}
          name="currency"
          required
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
          Duration (days)
        </span>
        <Input min="1" name="duration_days" placeholder="30" step="1" type="number" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
          Credits
        </span>
        <Input min="0" name="credits" placeholder="1000" step="1" type="number" />
      </label>

      <label className="flex items-center gap-2 pb-2 text-sm">
        <input defaultChecked name="is_active" type="checkbox" />
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
