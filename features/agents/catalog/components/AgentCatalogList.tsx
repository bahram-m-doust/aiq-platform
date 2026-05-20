import Link from "next/link";
import { BotIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AgentStateBadge } from "@/features/agents/catalog/components/AgentStateBadge";
import type { AgentCatalogWorkspace } from "@/features/agents/catalog/types";

export function AgentCatalogList({
  workspace,
}: {
  workspace: AgentCatalogWorkspace;
}) {
  return (
    <div className="grid gap-4">
      {!workspace.brainReady ? (
        <Card>
          <CardHeader>
            <CardTitle>Brand Brain readiness required</CardTitle>
            <CardDescription>
              {workspace.brainReadinessMessage}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {workspace.agents.map((agent) => (
        <Card key={agent.key}>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <BotIcon className="size-5" />
                  {agent.name}
                </CardTitle>
                <CardDescription>{agent.description}</CardDescription>
              </div>
              <AgentStateBadge state={agent.displayState} />
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[1fr_auto]">
            <p className="text-sm leading-6 text-muted-foreground">
              {agent.stateMessage}
            </p>
            <div className="flex items-start md:justify-end">
              <Button asChild variant="outline">
                <Link href={`/dashboard/agents/${agent.slug}`}>
                  Open agent
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

