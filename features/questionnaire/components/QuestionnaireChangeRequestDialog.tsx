"use client";

import { useActionState, useState } from "react";
import { BadgeCheckIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/features/auth/components/SubmitButton";
import { createChangeRequestAction } from "@/features/change-requests/actions";
import { initialCreateChangeRequestFormState } from "@/features/change-requests/schema";

export function QuestionnaireChangeRequestDialog({
  sectionKey,
  triggerClassName,
  triggerLabel = "Request a Change",
}: {
  sectionKey: string;
  triggerClassName?: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [state, formAction] = useActionState(
    async (
      previousState: typeof initialCreateChangeRequestFormState,
      formData: FormData,
    ) => {
      const nextState = await createChangeRequestAction(previousState, formData);

      if (nextState.status === "success") {
        setOpen(false);
        setReason("");
        setSubmittedMessage(
          "Your request is now under review. We'll notify you by email once a decision is made.",
        );
        setSuccessOpen(true);
      }

      return nextState;
    },
    initialCreateChangeRequestFormState,
  );
  const reasonIsEmpty = reason.trim().length === 0;

  return (
    <>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogTrigger asChild>
          {triggerClassName ? (
            <button className={triggerClassName} type="button">
              {triggerLabel}
            </button>
          ) : (
            <Button type="button">{triggerLabel}</Button>
          )}
        </DialogTrigger>
        <DialogContent
          className="max-w-xl"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Request a Change</DialogTitle>
            <DialogDescription>
              Tell us what needs to be updated. Your request will be reviewed
              before any locked answers are changed.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} className="grid gap-4">
            <input name="target_type" type="hidden" value="INTAKE_SECTION" />
            <input name="section_key" type="hidden" value={sectionKey} />
            <input name="question_target" type="hidden" value="" />
            <input name="module_id" type="hidden" value="" />
            <input name="comment" type="hidden" value={reason} />

            {state.status === "error" ? (
              <Alert variant="destructive">
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="change-request-reason">Reason</Label>
              <Textarea
                id="change-request-reason"
                name="reason"
                onChange={(event) => setReason(event.target.value)}
                placeholder="Write the reason for this change request"
                required
                value={reason}
              />
            </div>

            <div className="flex justify-end">
              <SubmitButton
                disabled={reasonIsEmpty}
                idleLabel="Request a Change"
                pendingLabel="Submitting"
              />
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setSuccessOpen} open={successOpen}>
        <DialogContent
          className="max-w-md"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgeCheckIcon className="size-5 text-emerald-600" />
              Request submitted
            </DialogTitle>
            <DialogDescription>
              {submittedMessage ??
                "Your request is now under review. We'll notify you by email once a decision is made."}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
