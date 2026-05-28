"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, SparklesIcon } from "lucide-react";

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
        <button
          className="group relative inline-flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-[14px] px-5 py-3 text-[14px] font-semibold transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
          style={{
            background:
              "linear-gradient(135deg, var(--bv-brand) 0%, var(--bv-brand-mid) 60%, var(--bv-brand-deep) 100%)",
            color: "var(--bv-brand-ink)",
            boxShadow:
              "0 8px 28px -10px var(--bv-brand-tint-32), 0 0 0 1px var(--bv-brand-mid)",
            animation: "ds-glow-pulse 2.4s var(--bv-ease) infinite",
          }}
          type="button"
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background:
                "linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
              backgroundSize: "200% 200%",
              animation: "bv-shimmer 2s linear infinite",
            }}
          />
          <SparklesIcon className="relative size-4" />
          <span className="relative">Submit Questionnaire</span>
          <ArrowRightIcon className="relative size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </button>
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
