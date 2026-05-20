"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  reviewChangeRequestAction,
} from "@/features/change-requests/actions";
import { initialReviewChangeRequestFormState } from "@/features/change-requests/schema";
import {
  changeRequestStatuses,
  type ChangeRequestReviewItem,
} from "@/features/change-requests/types";
import { SubmitButton } from "@/features/auth/components/SubmitButton";

const statusLabels: Record<(typeof changeRequestStatuses)[number], string> = {
  REQUESTED: "Requested",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  APPLIED: "Applied",
  CLOSED: "Closed",
};

export function ChangeRequestReviewForm({
  request,
}: {
  request: ChangeRequestReviewItem;
}) {
  const [state, formAction] = useActionState(
    reviewChangeRequestAction,
    initialReviewChangeRequestFormState,
  );

  return (
    <form action={formAction} className="grid gap-4">
      <input name="request_id" type="hidden" value={request.id} />
      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {state.status === "success" && state.requestId === request.id ? (
        <Alert>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`status-${request.id}`}>Status</Label>
          <Select defaultValue={request.status} name="status">
            <SelectTrigger id={`status-${request.id}`}>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {changeRequestStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabels[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`resolution-${request.id}`}>Resolution note</Label>
          <Textarea
            defaultValue={request.resolutionNote ?? ""}
            id={`resolution-${request.id}`}
            name="resolution_note"
            placeholder="Add reviewer context for this status change"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <SubmitButton idleLabel="Update status" pendingLabel="Updating" />
      </div>
    </form>
  );
}
