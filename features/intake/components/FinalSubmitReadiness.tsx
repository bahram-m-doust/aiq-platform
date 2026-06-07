"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, CheckCircleIcon, SparklesIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
        <button
          className="group relative inline-flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-[14px] px-5 py-3 text-[14px] font-semibold transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
          disabled={disabled}
          style={{
            background:
              "linear-gradient(135deg, var(--bv-brand) 0%, var(--bv-brand-mid) 60%, var(--bv-brand-deep) 100%)",
            color: "var(--bv-brand-ink)",
            boxShadow:
              "0 8px 28px -10px var(--bv-brand-tint-32), 0 0 0 1px var(--bv-brand-mid)",
            animation: "ds-glow-pulse 2.4s var(--bv-ease) infinite",
            opacity: disabled ? 0.6 : 1,
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
          <span className="relative">Approve &amp; Lock</span>
          <ArrowRightIcon className="relative size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </button>
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
