"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { createDemoRequestAction } from "@/features/demo-requests/actions";
import { initialCreateDemoRequestFormState } from "@/features/demo-requests/types";
import { SubmitButton } from "@/features/auth/components/SubmitButton";

export function AppActivationCtas() {
  const [state, formAction] = useActionState(
    createDemoRequestAction,
    initialCreateDemoRequestFormState,
  );

  if (state.status === "success") {
    return (
      <Alert>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-2">
      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <Textarea
        aria-label="Optional message for the platform team"
        maxLength={1000}
        name="message"
        placeholder="Tell us briefly what you'd like to evaluate (optional)"
        rows={3}
      />
      <SubmitButton
        idleLabel="Request Demo Access"
        pendingLabel="Submitting"
      />
    </form>
  );
}
