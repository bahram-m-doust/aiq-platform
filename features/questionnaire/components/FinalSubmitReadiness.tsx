"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { CheckCircleIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  finalSubmitIntakeAction,
} from "@/features/questionnaire/actions";
import {
  finalSubmitConfirmationCopy,
  initialFinalSubmitIntakeFormState,
} from "@/features/questionnaire/schemas";
import type { IntakeCompletion } from "@/features/questionnaire/types";

function ConfirmSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      {pending ? "Submitting..." : "Confirm"}
    </Button>
  );
}

export function FinalSubmitReadiness({
  completion,
  disabled = false,
  sessionId,
  canApprove = true,
}: {
  completion: IntakeCompletion;
  disabled?: boolean;
  sessionId: string;
  canApprove?: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    finalSubmitIntakeAction,
    initialFinalSubmitIntakeFormState,
  );
  // Mirror the server-side gate (validateFinalSubmitCompletion): require every
  // question answered, not just a rounded 100% that could come from stale data.
  const isReady =
    completion.totalQuestions > 0 &&
    completion.completionPercent === 100 &&
    completion.answeredQuestions === completion.totalQuestions;

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  if (!isReady) return null;

  // Everything is answered, but only the brand Owner can approve & lock.
  if (!canApprove) {
    return (
      <div
        className="flex items-center gap-2.5 rounded-[14px] border border-dashed px-4 py-3 text-[13px] text-[var(--bv-ink-2)]"
        style={{ borderColor: "var(--bv-line-2)" }}
      >
        <CheckCircleIcon className="size-4 shrink-0 text-emerald-500" />
        <span>
          All sections are complete — awaiting your brand{" "}
          <strong className="font-medium text-[var(--bv-ink)]">Owner</strong>{" "}
          to approve and lock the questionnaire.
        </span>
      </div>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={disabled} size="lg" type="button">
          Approve &amp; Lock
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve &amp; lock questionnaire</DialogTitle>
          <DialogDescription>{finalSubmitConfirmationCopy}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input name="session_id" type="hidden" value={sessionId} />
          {state.status === "error" ? (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <ConfirmSubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
