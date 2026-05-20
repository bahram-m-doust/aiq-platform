"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { LockKeyholeIcon } from "lucide-react";

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
  initialFinalSubmitIntakeFormState,
} from "@/features/intake/actions";
import { finalSubmitConfirmationCopy } from "@/features/intake/schemas";
import type { IntakeCompletion } from "@/features/intake/types";

function ConfirmSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      {pending ? "Submitting" : "Confirm final submission"}
    </Button>
  );
}

export function FinalSubmitReadiness({
  completion,
  sessionId,
}: {
  completion: IntakeCompletion;
  sessionId: string;
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

  return (
    <section className="rounded-lg border border-border p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Final Submit readiness</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Final Submit becomes available only when every required question is
            complete. Submission locks the Strategic Intake and creates the
            official snapshot for the next stage of work.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button disabled={!isReady} type="button">
              <LockKeyholeIcon className="size-4" />
              Final Submit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm final submission</DialogTitle>
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
      </div>
    </section>
  );
}
