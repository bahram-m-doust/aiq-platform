"use client";

import { useState, useTransition } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canReview =
    actorRole === "PLATFORM_OWNER" || actorRole === "SUPERVISOR";
  const pdfReady = canSendArtifactToClientReview(latestArtifact);

  function handleConfirm() {
    setErrorMessage(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("module_id", module.id);
      const result = await sendModuleToClientReviewAction(
        initialModuleActionFormState,
        formData,
      );
      if (result.status === "error") {
        setErrorMessage(result.message);
        return;
      }
      if (result.status === "success") {
        setSuccessMessage(result.message);
      }
      setOpen(false);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Supervisor gate</CardTitle>
        <CardDescription>
          A PDF artifact is required before a module can enter client review.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage && !open ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        {successMessage ? (
          <Alert>
            <AlertDescription>{successMessage}</AlertDescription>
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
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={!canReview || !pdfReady}>
                <SendIcon className="size-4" />
                Approve for client review
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Approve for client review</DialogTitle>
                <DialogDescription>
                  Are you sure you want to send this module to client review?
                  The client will be able to view and review the latest PDF
                  artifact.
                </DialogDescription>
              </DialogHeader>
              {errorMessage ? (
                <Alert variant="destructive">
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              ) : null}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button onClick={handleConfirm} disabled={isPending}>
                  {isPending ? "Approving..." : "Confirm"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
