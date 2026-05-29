import { AgentActivationForm } from "@/features/agents/catalog/components/AgentActivationForm";
import { AgentStateBadge } from "@/features/agents/catalog/components/AgentStateBadge";
import { AgentRunHistory } from "@/features/agents/runs/components/AgentRunHistory";
import { AgentRunPanel } from "@/features/agents/runs/components/AgentRunPanel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  AgentCatalogAccess,
  AgentCatalogItem,
} from "@/features/agents/catalog/types";
import type { AgentRunHistoryItem } from "@/features/agents/runs/types";
import type { ImageModelId, TextModelId } from "@/lib/openrouter/models";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not recorded";
}

export function AgentDetail({
  access,
  agent,
  runHistory = [],
  defaultTextModel,
  defaultImageModel,
}: {
  access: AgentCatalogAccess;
  agent: AgentCatalogItem;
  runHistory?: AgentRunHistoryItem[];
  defaultTextModel?: TextModelId;
  defaultImageModel?: ImageModelId;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle>{agent.name}</CardTitle>
              <CardDescription>{agent.description}</CardDescription>
            </div>
            <AgentStateBadge state={agent.displayState} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">
            {agent.stateMessage}
          </p>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Brand</dt>
              <dd className="font-medium">{access.brandName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium">{access.membershipRole}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Activated</dt>
              <dd className="font-mono">{formatDate(agent.activatedAt)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {agent.displayState === "ACTIVE" ? (
        <>
          <AgentRunPanel
            agent={agent}
            defaultImageModel={defaultImageModel}
            defaultTextModel={defaultTextModel}
          />
          <AgentRunHistory history={runHistory} />
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Activation</CardTitle>
            <CardDescription>
              Owners and Executive Managers can activate available agents after
              Brand Brain is ready.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AgentActivationForm agent={agent} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
