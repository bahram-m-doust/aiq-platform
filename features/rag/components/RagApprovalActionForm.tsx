"use client";

import { useState, useTransition } from "react";
import { CheckCircleIcon, ShieldCheckIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  approveRagPlatformOwnerAction,
  approveRagSupervisorAction,
} from "@/features/rag/actions";
import { initialRagApprovalFormState } from "@/features/rag/schema";
import type { RagApprovalStage } from "@/features/rag/types";

export function RagApprovalActionForm({
  artifactId,
  stage,
  disabled = false,
}: {
  artifactId: string;
  stage: RagApprovalStage;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const action =
    stage === "SUPERVISOR"
      ? approveRagSupervisorAction
      : approveRagPlatformOwnerAction;
  const Icon = stage === "SUPERVISOR" ? ShieldCheckIcon : CheckCircleIcon;
  const label =
    stage === "SUPERVISOR"
      ? "Supervisor approve"
      : "Final RAG approve";
  const confirmMessage =
    stage === "SUPERVISOR"
      ? "Are you sure you want to approve this artifact for supervisor review?"
      : "Are you sure you want to give final RAG approval for this artifact?";

  function handleConfirm() {
    setErrorMessage(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("artifact_id", artifactId);
      const result = await action(initialRagApprovalFormState, formData);
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
    <div className="space-y-3">
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button disabled={disabled} variant="outline">
            <Icon className="size-4" />
            {label}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>{confirmMessage}</DialogDescription>
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
  );
}
