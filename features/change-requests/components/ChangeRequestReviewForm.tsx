"use client";

import { useState, useTransition } from "react";
import { ClipboardCheckIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  reviewChangeRequestAction,
} from "@/features/change-requests/actions";
import { initialReviewChangeRequestFormState } from "@/features/change-requests/schema";
import {
  changeRequestStatuses,
  type ChangeRequestReviewItem,
  type ChangeRequestStatus,
} from "@/features/change-requests/types";

const statusLabels: Record<ChangeRequestStatus, string> = {
  REQUESTED: "Requested",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  APPLIED: "Applied",
  CLOSED: "Closed",
};

function statusBadgeClass(status: ChangeRequestStatus) {
  switch (status) {
    case "REJECTED":
    case "CLOSED":
      return "bg-destructive/15 text-destructive";
    case "APPROVED":
    case "APPLIED":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
    case "UNDER_REVIEW":
    case "REQUESTED":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    default:
      return "bg-primary/10 text-primary";
  }
}

function StatusBadge({ status }: { status: ChangeRequestStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        statusBadgeClass(status),
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

function isDestructiveStatus(status: string) {
  return status === "REJECTED" || status === "CLOSED";
}

function isApprovalStatus(status: string) {
  return status === "APPROVED";
}

export function ChangeRequestReviewForm({
  request,
}: {
  request: ChangeRequestReviewItem;
}) {
  const [open, setOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>(request.status);
  const [resolutionNote, setResolutionNote] = useState(
    request.resolutionNote ?? "",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setErrorMessage(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("request_id", request.id);
      formData.append("status", selectedStatus);
      formData.append("resolution_note", resolutionNote);
      const result = await reviewChangeRequestAction(
        initialReviewChangeRequestFormState,
        formData,
      );
      if (result.status === "error") {
        setErrorMessage(result.message);
        return;
      }
      setOpen(false);
    });
  }

  function handleOpenChange(next: boolean) {
    if (!isPending) {
      setOpen(next);
      if (!next) setErrorMessage(null);
    }
  }

  function handleOpen() {
    setSelectedStatus(request.status);
    setResolutionNote(request.resolutionNote ?? "");
    setErrorMessage(null);
    setOpen(true);
  }

  const destructive = isDestructiveStatus(selectedStatus);
  const approval = isApprovalStatus(selectedStatus);

  return (
    <div className="flex items-center gap-3">
      <StatusBadge status={request.status} />
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <Button
          onClick={handleOpen}
          size="sm"
          type="button"
          variant="outline"
        >
          <ClipboardCheckIcon className="mr-1.5 size-4" />
          Review
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Change Request</DialogTitle>
            <DialogDescription>
              <span className="block">
                <span className="font-medium text-foreground">
                  {request.targetLabel}
                </span>{" "}
                for {request.brandName}
              </span>
              <span className="mt-1 block">
                Requested by {request.requesterEmail ?? "unknown user"}.
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {request.reason ? (
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Reason
                </p>
                <p className="mt-1 text-sm leading-6">{request.reason}</p>
              </div>
            ) : null}

            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Comment
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                {request.comment}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`dialog-status-${request.id}`}>Status</Label>
              <Select
                onValueChange={setSelectedStatus}
                value={selectedStatus}
              >
                <SelectTrigger id={`dialog-status-${request.id}`}>
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
              <Label htmlFor={`dialog-resolution-${request.id}`}>
                Resolution note
              </Label>
              <Textarea
                id={`dialog-resolution-${request.id}`}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Add reviewer context for this status change"
                value={resolutionNote}
              />
            </div>
          </div>

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className={cn(
                approval &&
                  "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700",
              )}
              disabled={isPending}
              onClick={handleConfirm}
              type="button"
              variant={destructive ? "destructive" : "default"}
            >
              {isPending
                ? "Updating..."
                : destructive
                  ? "Confirm & update"
                  : "Update status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
