import type { AgentEntitlementStatus } from "@/features/access/types";

export type AgentLookupRecord = {
  id: string;
  key: string;
};

export type AgentEntitlementUpsert = {
  brand_id: string;
  agent_id: string;
  plan_id: string;
  status: AgentEntitlementStatus;
  starts_at: string;
  expires_at: string | null;
};

export function parseIncludedAgentKeys(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function buildAgentEntitlementUpserts({
  brandId,
  planId,
  startsAt,
  expiresAt,
  agents,
}: {
  brandId: string;
  planId: string;
  startsAt: string;
  expiresAt: string | null;
  agents: AgentLookupRecord[];
}): AgentEntitlementUpsert[] {
  return agents.map((agent) => ({
    brand_id: brandId,
    agent_id: agent.id,
    plan_id: planId,
    status: "LOCKED_BY_BRAIN",
    starts_at: startsAt,
    expires_at: expiresAt,
  }));
}

export function findUnmatchedAgentKeys({
  includedAgentKeys,
  agents,
}: {
  includedAgentKeys: string[];
  agents: AgentLookupRecord[];
}) {
  const matchedKeys = new Set(agents.map((agent) => agent.key));
  return includedAgentKeys.filter((key) => !matchedKeys.has(key));
}
