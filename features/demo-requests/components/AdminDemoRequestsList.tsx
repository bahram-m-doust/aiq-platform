"use client";

import { useState } from "react";
import { ExternalLinkIcon, XCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useConfirmAction } from "@/components/hooks/useConfirmAction";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { rejectDemoRequestAction } from "@/features/demo-requests/actions";
import type { DemoRequestRecord } from "@/features/demo-requests/types";
import { initialReviewDemoRequestFormState } from "@/features/demo-requests/types";

function StatusBadge({ status }: { status: string }) {
  const badgeClass =
    status === "REQUESTED"
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      : status === "APPROVED"
        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
        : status === "REJECTED"
          ? "bg-destructive/15 text-destructive"
          : "bg-primary/10 text-primary";

  const label =
    status === "REQUESTED"
      ? "Pending"
      : status.charAt(0) + status.slice(1).toLowerCase();

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        badgeClass,
      )}
    >
      {label}
    </span>
  );
}

function RejectDialog({ request }: { request: DemoRequestRecord }) {
  const [resolutionNote, setResolutionNote] = useState("");

  const { open, handleOpenChange, errorMessage, isPending, confirm } =
    useConfirmAction({
      action: rejectDemoRequestAction,
      initialState: initialReviewDemoRequestFormState,
      buildFormData: () => {
        const fd = new FormData();
        fd.append("demo_request_id", request.id);
        fd.append("resolution_note", resolutionNote);
        return fd;
      },
    });

  function onOpenChange(next: boolean) {
    handleOpenChange(next);
    if (!next) setResolutionNote("");
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      trigger={
        <Button size="sm" type="button" variant="ghost">
          <XCircleIcon className="mr-1.5 size-4 text-destructive" />
          Reject
        </Button>
      }
      title="Reject demo request?"
      description={`You are about to reject the demo request from ${request.email}. This action cannot be undone.`}
      errorMessage={errorMessage}
      isPending={isPending}
      onConfirm={confirm}
      confirmLabel="Reject request"
      pendingLabel="Rejecting..."
    >
      <div className="space-y-2">
        <Label htmlFor={`reject-note-${request.id}`}>
          Resolution note (optional)
        </Label>
        <Textarea
          id={`reject-note-${request.id}`}
          maxLength={1000}
          onChange={(e) => setResolutionNote(e.target.value)}
          placeholder="Reason for rejection (audit only)"
          rows={3}
          value={resolutionNote}
        />
      </div>
    </ConfirmDialog>
  );
}

function ReviewActions({ request }: { request: DemoRequestRecord }) {
  const reviewHref = `/admin/access-keys?email=${encodeURIComponent(
    request.email,
  )}&type=DEMO_ACCESS&demo_request_id=${encodeURIComponent(request.id)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild type="button">
        <a href={reviewHref}>
          <ExternalLinkIcon className="mr-1.5 size-4" />
          Review &amp; approve
        </a>
      </Button>
      <RejectDialog request={request} />
    </div>
  );
}

export function AdminDemoRequestsList({
  requests,
}: {
  requests: DemoRequestRecord[];
}) {
  if (requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No pending demo requests</CardTitle>
          <CardDescription>
            New requests submitted from the dashboard will appear here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <Card key={request.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-base">{request.email}</CardTitle>
                <CardDescription>
                  Requested{" "}
                  {request.createdAt
                    ? new Date(request.createdAt).toLocaleString()
                    : "recently"}
                </CardDescription>
              </div>
              <StatusBadge status={request.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {request.message ? (
              <blockquote className="rounded-lg border border-border bg-muted/40 p-3 text-sm leading-6">
                {request.message}
              </blockquote>
            ) : (
              <p className="text-sm text-muted-foreground">
                No message provided.
              </p>
            )}
            <ReviewActions request={request} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
