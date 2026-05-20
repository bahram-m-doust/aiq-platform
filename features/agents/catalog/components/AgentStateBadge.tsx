import { agentDisplayStateLabels } from "@/features/agents/catalog/schema";
import type { CatalogAgentDisplayState } from "@/features/agents/catalog/types";

export function AgentStateBadge({
  state,
}: {
  state: CatalogAgentDisplayState;
}) {
  return (
    <span className="inline-flex rounded-lg border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground">
      {agentDisplayStateLabels[state]}
    </span>
  );
}

