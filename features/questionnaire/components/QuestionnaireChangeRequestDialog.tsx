"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { createChangeRequestAction } from "@/features/change-requests/actions";
import { initialCreateChangeRequestFormState } from "@/features/change-requests/schema";

export function QuestionnaireChangeRequestDialog() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, formAction, pending] = useActionState(
    createChangeRequestAction,
    initialCreateChangeRequestFormState,
  );

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          Change Request
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Request</DialogTitle>
          <DialogDescription>
            Tell us why this locked questionnaire needs a change.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input name="target_type" type="hidden" value="INTAKE_SECTION" />
          <input name="section_key" type="hidden" value="" />
          <input name="question_target" type="hidden" value="" />
          <input name="module_id" type="hidden" value="" />
          <input name="comment" type="hidden" value={reason} />
          <Textarea
            name="reason"
            onChange={(event) => setReason(event.target.value)}
            placeholder="Write the reason for requesting a change..."
            required
            value={reason}
          />
          {state.status !== "idle" ? (
            <p
              className={
                state.status === "error"
                  ? "text-sm text-destructive"
                  : "text-sm text-emerald-700"
              }
            >
              {state.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={pending || !reason.trim()} type="submit">
              Submit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
