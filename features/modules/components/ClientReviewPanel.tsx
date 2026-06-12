"use client";

import { useActionState } from "react";
import { CheckCircleIcon, RotateCcwIcon } from "lucide-react";

import { ReviewSurface } from "@/components/review/ReviewSurface";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  approveClientModuleAction,
  requestClientModuleChangeAction,
} from "@/features/modules/actions";
import { initialModuleActionFormState } from "@/features/modules/schema";
import type {
  ClientModuleReviewPageData,
  ModuleActionFormState,
} from "@/features/modules/types";

function StateAlert({ state }: { state: ModuleActionFormState }) {
  if (state.status === "idle") {
    return null;
  }

  return (
    <Alert variant={state.status === "error" ? "destructive" : "default"}>
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}

export function ClientReviewPanel({
  data,
  currentUserId,
}: {
  data: ClientModuleReviewPageData;
  currentUserId: string;
}) {
  const [approveState, approveAction, approvePending] = useActionState(
    approveClientModuleAction,
    initialModuleActionFormState,
  );
  const [changeState, changeAction, changePending] = useActionState(
    requestClientModuleChangeAction,
    initialModuleActionFormState,
  );
  const decisionPending = approvePending || changePending;
  const canDecide =
    data.module.status === "CLIENT_REVIEW" && !decisionPending;
  const fileName = data.clientFileName ?? "Client review PDF";

  return (
    <div className="space-y-6">
      <ReviewSurface
        canComment={canDecide}
        comments={data.comments}
        currentUserId={currentUserId}
        downloadName={fileName}
        emptyState={
          <Card>
            <CardHeader>
              <CardTitle>Client review file</CardTitle>
              <CardDescription>{fileName}</CardDescription>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertDescription>
                  A client-review document is not available for this module yet.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        }
        eyebrow="Module · Client review"
        inlineUrl={data.inlineUrl}
        markdown={data.markdown}
        signedUrl={data.signedUrl}
        subjectId={data.module.id}
        subjectType="MODULE"
        title={data.module.title}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Approve module</CardTitle>
            <CardDescription>
              Client approval records the business decision only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={approveAction} className="grid gap-4">
              <input name="module_id" type="hidden" value={data.module.id} />
              <StateAlert state={approveState} />
              <div className="space-y-2">
                <Label htmlFor="approval-comment">Optional comment</Label>
                <Textarea
                  disabled={!canDecide}
                  id="approval-comment"
                  name="comment"
                />
              </div>
              <Button disabled={!canDecide} type="submit">
                <CheckCircleIcon className="size-4" />
                Approve module
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request change</CardTitle>
            <CardDescription>
              Change requests reopen the module for internal revision.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={changeAction} className="grid gap-4">
              <input name="module_id" type="hidden" value={data.module.id} />
              <StateAlert state={changeState} />
              <div className="space-y-2">
                <Label htmlFor="change-comment">Required comment</Label>
                <Textarea
                  disabled={!canDecide}
                  id="change-comment"
                  name="comment"
                  required
                />
              </div>
              <Button disabled={!canDecide} type="submit" variant="outline">
                <RotateCcwIcon className="size-4" />
                Request change
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
