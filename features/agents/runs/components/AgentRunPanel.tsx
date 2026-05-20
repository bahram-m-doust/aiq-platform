"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AgentCatalogItem } from "@/features/agents/catalog/types";
import {
  initialAgentRunFormState,
  runAgentAction,
} from "@/features/agents/runs/actions";
import { agentRunPromptMaxLength } from "@/features/agents/runs/schema";

function RunSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      <SendIcon className="size-4" />
      {pending ? "Running agent" : "Run agent"}
    </Button>
  );
}

export function AgentRunPanel({ agent }: { agent: AgentCatalogItem }) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    runAgentAction,
    initialAgentRunFormState,
  );

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run {agent.name}</CardTitle>
        <CardDescription>
          The agent will use the approved knowledge base for the current brand.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={formAction} className="space-y-3">
          <input name="agent_key" type="hidden" value={agent.key} />
          <div className="space-y-2">
            <Label htmlFor="agent-run-prompt">Request</Label>
            <Textarea
              id="agent-run-prompt"
              maxLength={agentRunPromptMaxLength}
              name="prompt"
              placeholder="Enter a strategic request for this agent."
              required
              rows={5}
            />
          </div>
          <RunSubmitButton />
        </form>

        {state.status === "error" ? (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        {state.status === "success" && state.answer ? (
          <section className="space-y-4 rounded-lg border border-border p-4">
            <div>
              <h2 className="text-base font-semibold">Latest response</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {state.answer}
              </p>
            </div>
            {state.sources && state.sources.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Sources</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {state.sources.map((source) => (
                    <li key={`${source.fileName}-${source.score ?? "source"}`}>
                      {source.fileName}
                      {source.score !== null
                        ? ` (${Math.round(source.score * 100)}%)`
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}

