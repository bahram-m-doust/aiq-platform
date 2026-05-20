"use client";

import { useActionState } from "react";
import { SendIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  sendModuleToClientReviewAction,
} from "@/features/modules/actions";
import {
  canSendArtifactToClientReview,
  initialModuleActionFormState,
} from "@/features/modules/schema";
import type {
  AdminModuleRole,
  ModuleArtifactRecord,
  ModuleRecord,
} from "@/features/modules/types";

export function SupervisorReviewPanel({
  actorRole,
  module,
  latestArtifact,
}: {
  actorRole: AdminModuleRole;
  module: ModuleRecord;
  latestArtifact: ModuleArtifactRecord | null;
}) {
  const [state, formAction] = useActionState(
    sendModuleToClientReviewAction,
    initialModuleActionFormState,
  );
  const canReview =
    actorRole === "PLATFORM_OWNER" || actorRole === "SUPERVISOR";
  const pdfReady = canSendArtifactToClientReview(latestArtifact);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Supervisor gate</CardTitle>
        <CardDescription>
          A PDF artifact is required before a module can enter client review.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.status === "error" ? (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        {state.status === "success" ? (
          <Alert>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Latest artifact</dt>
            <dd>
              {latestArtifact
                ? `${latestArtifact.artifactType} v${latestArtifact.version}`
                : "None"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Artifact status</dt>
            <dd>{latestArtifact?.status ?? "Not available"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Client-ready file</dt>
            <dd>{pdfReady ? "Ready" : "PDF required"}</dd>
          </div>
        </dl>
        <form action={formAction} className="flex justify-end">
          <input name="module_id" type="hidden" value={module.id} />
          <Button disabled={!canReview || !pdfReady} type="submit">
            <SendIcon className="size-4" />
            Approve for client review
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
