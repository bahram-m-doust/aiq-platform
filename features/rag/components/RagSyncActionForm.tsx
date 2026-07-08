"use client";

import { useActionState } from "react";
import { RefreshCwIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { syncBrandKnowledgeBaseAction } from "@/features/rag/actions";
import { initialRagSyncFormState } from "@/features/rag/schema";

export function RagSyncActionForm({
  brandId,
  disabled = false,
}: {
  brandId: string;
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState(
    syncBrandKnowledgeBaseAction,
    initialRagSyncFormState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="brand_id" type="hidden" value={brandId} />
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
      <Button disabled={disabled} type="submit">
        <RefreshCwIcon className="size-4" />
        Sync / retry files
      </Button>
    </form>
  );
}
