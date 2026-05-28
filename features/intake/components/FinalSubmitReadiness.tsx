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
} from "@/features/intake/actions";
import {
  finalSubmitConfirmationCopy,
  initialFinalSubmitIntakeFormState,
} from "@/features/intake/schemas";
import type { IntakeCompletion } from "@/features/intake/types";

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

  if (!isReady) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          className="gap-2 rounded-full px-6 shadow-md"
          size="lg"
          type="button"
        >
          <CheckCircleIcon className="size-4" />
          Submit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit questionnaire</DialogTitle>
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
