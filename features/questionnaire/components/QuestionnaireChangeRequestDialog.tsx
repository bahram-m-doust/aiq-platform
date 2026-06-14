"use client";

import { useActionState, useState, type ReactNode } from "react";
import { BadgeCheckIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  children,
  sectionKey,
}: {
  children?: ReactNode;
  sectionKey: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, formAction] = useActionState(
    createChangeRequestAction,
    initialCreateChangeRequestFormState,
  );
  const reasonIsEmpty = reason.trim().length === 0;

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        {children ?? <Button type="button">Request a Change</Button>}
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

          {state.status === "success" ? (
            <Alert>
              <BadgeCheckIcon className="size-4" />
              <AlertTitle>Change Request submitted</AlertTitle>
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
  );
}
