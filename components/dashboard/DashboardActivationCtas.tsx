"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createDemoRequestAction } from "@/features/demo-requests/actions";
import { initialCreateDemoRequestFormState } from "@/features/demo-requests/types";
import { SubmitButton } from "@/features/auth/components/SubmitButton";

export function DashboardActivationCtas() {
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
      <div className="flex flex-col gap-2 sm:flex-row">
        <SubmitButton
          idleLabel="Request Demo Access"
          pendingLabel="Submitting"
        />
        <Button asChild type="button" variant="outline">
          <a href="mailto:hello@bextudio.com">Contact Bextudio</a>
        </Button>
      </div>
    </form>
  );
}
