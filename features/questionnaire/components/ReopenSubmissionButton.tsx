"use client";

import { useActionState } from "react";
import { RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { reopenIntakeSubmissionAction } from "@/features/questionnaire/actions";
import type { ReopenIntakeFormState } from "@/features/questionnaire/types";

const initialState: ReopenIntakeFormState = { status: "idle" };

export function ReopenSubmissionButton({ snapshotId }: { snapshotId: string }) {
  const [state, formAction, isPending] = useActionState(
    reopenIntakeSubmissionAction,
    initialState,
  );

  if (state.status === "success") {
    return (
      <span className="text-xs text-emerald-600">{state.message}</span>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input name="snapshot_id" type="hidden" value={snapshotId} />
      <Button
        className="gap-1.5"
        disabled={isPending}
        size="sm"
        type="submit"
        variant="outline"
      >
        <RotateCcwIcon className="size-3.5" />
        {isPending ? "Reopening…" : "Return to user for editing"}
      </Button>
      {state.status === "error" ? (
        <span className="text-xs text-destructive">{state.message}</span>
      ) : null}
    </form>
  );
}
