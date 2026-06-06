"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { decideStakeholderReportAction } from "@/features/stakeholder-interviews/actions";
import { initialStakeholderActionState } from "@/features/stakeholder-interviews/schema";

function DecisionButtons() {
  const { pending } = useFormStatus();
  return (
    <div className="flex justify-end gap-2">
      <Button
        disabled={pending}
        name="decision"
        type="submit"
        value="CHANGES_REQUESTED"
        variant="outline"
      >
        Request changes
      </Button>
      <Button disabled={pending} name="decision" type="submit" value="APPROVED">
        {pending ? "Submitting…" : "Approve & continue"}
      </Button>
    </div>
  );
}

export function ReviewDecisionPanel() {
  const [state, formAction] = useActionState(
    decideStakeholderReportAction,
    initialStakeholderActionState,
  );

  return (
    <form action={formAction} className="space-y-3">
      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {state.status === "success" ? (
        <Alert>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <DecisionButtons />
    </form>
  );
}
