"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  approveDemoRequestAction,
  rejectDemoRequestAction,
} from "@/features/demo-requests/actions";
import type { DemoRequestRecord } from "@/features/demo-requests/types";
import { initialReviewDemoRequestFormState } from "@/features/demo-requests/types";

function ApproveButtons({ request }: { request: DemoRequestRecord }) {
  const [approveState, approveAction] = useActionState(
    approveDemoRequestAction,
    initialReviewDemoRequestFormState,
  );
  const [rejectState, rejectAction] = useActionState(
    rejectDemoRequestAction,
    initialReviewDemoRequestFormState,
  );
  const customizeHref = `/admin/access-keys?email=${encodeURIComponent(
    request.email,
  )}&type=DEMO_ACCESS&demo_request_id=${encodeURIComponent(request.id)}`;

  return (
    <div className="space-y-3">
      {approveState.status === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>{approveState.message}</AlertDescription>
        </Alert>
      ) : null}
      {approveState.status === "success" ? (
        <Alert>
          <AlertDescription>{approveState.message}</AlertDescription>
        </Alert>
      ) : null}
      {rejectState.status === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>{rejectState.message}</AlertDescription>
        </Alert>
      ) : null}
      {rejectState.status === "success" ? (
        <Alert>
          <AlertDescription>{rejectState.message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <form action={approveAction}>
          <input
            name="demo_request_id"
            type="hidden"
            value={request.id}
          />
          <Button type="submit">Approve & email key</Button>
        </form>
        <Button asChild type="button" variant="outline">
          <a href={customizeHref}>Customize</a>
        </Button>
      </div>
      <form action={rejectAction} className="space-y-2">
        <input name="demo_request_id" type="hidden" value={request.id} />
        <Textarea
          aria-label="Resolution note (sent to audit log)"
          maxLength={1000}
          name="resolution_note"
          placeholder="Optional reason for rejection (audit only)"
          rows={2}
        />
        <Button type="submit" variant="destructive">
          Reject
        </Button>
      </form>
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
            <CardTitle className="text-base">{request.email}</CardTitle>
            <CardDescription>
              Requested{" "}
              {request.createdAt
                ? new Date(request.createdAt).toLocaleString()
                : "recently"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {request.message ? (
              <blockquote className="rounded border border-border bg-muted/40 p-3 text-sm leading-6">
                {request.message}
              </blockquote>
            ) : (
              <p className="text-sm text-muted-foreground">
                No message provided.
              </p>
            )}
            <ApproveButtons request={request} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
