import { Badge } from "@/components/ui/badge";
import { agentDisplayStateLabels } from "@/features/agents/catalog/schema";
import type { CatalogAgentDisplayState } from "@/features/agents/catalog/types";

export function AgentStateBadge({
  state,
}: {
  state: CatalogAgentDisplayState;
}) {
  return <Badge variant="secondary">{agentDisplayStateLabels[state]}</Badge>;
}
