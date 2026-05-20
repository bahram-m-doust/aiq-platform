"use client";

import { useActionState } from "react";
import { CheckCircleIcon, ShieldCheckIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  const action =
    stage === "SUPERVISOR"
      ? approveRagSupervisorAction
      : approveRagPlatformOwnerAction;
  const [state, formAction] = useActionState(
    action,
    initialRagApprovalFormState,
  );
  const Icon = stage === "SUPERVISOR" ? ShieldCheckIcon : CheckCircleIcon;
  const label =
    stage === "SUPERVISOR"
      ? "Supervisor approve"
      : "Final RAG approve";

  return (
    <form action={formAction} className="space-y-3">
      <input name="artifact_id" type="hidden" value={artifactId} />
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
      <Button disabled={disabled} type="submit" variant="outline">
        <Icon className="size-4" />
        {label}
      </Button>
    </form>
  );
}
