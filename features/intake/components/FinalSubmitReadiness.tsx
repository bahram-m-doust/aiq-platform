"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { CheckCircleIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DSButton } from "@/components/ds/Button";
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
} from "@/features/intake/actions";
import {
  finalSubmitConfirmationCopy,
  initialFinalSubmitIntakeFormState,
} from "@/features/intake/schemas";
import type { IntakeCompletion } from "@/features/intake/types";

function ConfirmSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <DSButton disabled={pending} type="submit" variant="brand">
      {pending ? "Submitting..." : "Confirm"}
    </DSButton>
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
  const isReady =
    completion.totalQuestions > 0 && completion.completionPercent === 100;

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
        <Button className="w-full" disabled={disabled} size="lg" type="button">
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
              <DSButton type="button" variant="outline">
                Cancel
              </DSButton>
            </DialogClose>
            <ConfirmSubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
