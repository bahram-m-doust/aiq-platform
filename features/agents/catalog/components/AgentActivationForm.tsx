"use client";

import { useActionState } from "react";
import { CheckCircleIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  activateAgentAction,
  initialAgentActivationFormState,
} from "@/features/agents/catalog/actions";
import type { AgentCatalogItem } from "@/features/agents/catalog/types";

export function AgentActivationForm({
  agent,
}: {
  agent: AgentCatalogItem;
}) {
  const [state, formAction] = useActionState(
    activateAgentAction,
    initialAgentActivationFormState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="agent_key" type="hidden" value={agent.key} />
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
      <Button disabled={!agent.isActivatable} type="submit">
        <CheckCircleIcon className="size-4" />
        Activate agent
      </Button>
    </form>
  );
}

