"use client";

import { useActionState } from "react";
import {
  CheckCircleIcon,
  MessageSquareIcon,
  RotateCcwIcon,
} from "lucide-react";

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
  addClientModuleCommentAction,
  approveClientModuleAction,
  initialModuleActionFormState,
  requestClientModuleChangeAction,
} from "@/features/modules/actions";
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
}: {
  data: ClientModuleReviewPageData;
}) {
  const [commentState, commentAction] = useActionState(
    addClientModuleCommentAction,
    initialModuleActionFormState,
  );
  const [approveState, approveAction] = useActionState(
    approveClientModuleAction,
    initialModuleActionFormState,
  );
  const [changeState, changeAction] = useActionState(
    requestClientModuleChangeAction,
    initialModuleActionFormState,
  );
  const canDecide = data.module.status === "CLIENT_REVIEW";
  const fileName =
    data.latestClientArtifact?.file?.originalName ?? "Client review PDF";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Client review file</CardTitle>
          <CardDescription>
            {fileName}
            {data.signedUrlExpiresInSeconds
              ? ` | Signed URL expires in ${data.signedUrlExpiresInSeconds} seconds`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.signedUrl ? (
            <iframe
              className="h-[72vh] w-full rounded-lg border border-border bg-muted"
              src={data.signedUrl}
              title={`${data.module.title} PDF preview`}
            />
          ) : (
            <Alert variant="destructive">
              <AlertDescription>
                A client-review PDF is not available for this module.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Client comments</CardTitle>
          <CardDescription>
            Record review notes for the internal delivery team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={commentAction} className="grid gap-4">
            <input name="module_id" type="hidden" value={data.module.id} />
            <StateAlert state={commentState} />
            <div className="space-y-2">
              <Label htmlFor="module-comment">Comment</Label>
              <Textarea
                disabled={!canDecide}
                id="module-comment"
                name="comment"
                required
              />
            </div>
            <div className="flex justify-end">
              <Button disabled={!canDecide} type="submit" variant="outline">
                <MessageSquareIcon className="size-4" />
                Add comment
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
