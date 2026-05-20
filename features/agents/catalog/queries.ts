import "server-only";

import { getBrandBrainWorkspace } from "@/features/agents/brain/queries";
import {
  catalogAgentDefinitions,
  catalogAgentKeyFromRoute,
  catalogAgentKeys,
  deriveAgentDisplayState,
} from "@/features/agents/catalog/schema";
import type {
  AgentCatalogItem,
  AgentCatalogWorkspace,
  CatalogAgentKey,
} from "@/features/agents/catalog/types";
import { createAdminClient } from "@/lib/supabase/admin";

type AgentRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
};

type AgentEntitlementRow = {
  id: string;
  agent_id: string;
  status: string;
  activated_at: string | null;
};

async function getCatalogAgentsByKey() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agents")
    .select("id, key, name, description")
    .in("key", [...catalogAgentKeys])
    .eq("is_active", true);

  if (error) {
    throw error;
  }

  return new Map(
    ((data ?? []) as AgentRow[]).map((agent) => [
      agent.key as CatalogAgentKey,
      agent,
    ]),
  );
}

async function getEntitlementsByAgentId({
  brandId,
  agentIds,
}: {
  brandId: string;
  agentIds: string[];
}) {
  if (agentIds.length === 0) {
    return new Map<string, AgentEntitlementRow>();
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agent_entitlements")
    .select("id, agent_id, status, activated_at")
    .eq("brand_id", brandId)
    .in("agent_id", agentIds);

  if (error) {
    throw error;
  }

  return new Map(
    ((data ?? []) as AgentEntitlementRow[]).map((entitlement) => [
      entitlement.agent_id,
      entitlement,
    ]),
  );
}

export async function getAgentCatalogWorkspace(
  profileId: string,
): Promise<AgentCatalogWorkspace | null> {
  const brainWorkspace = await getBrandBrainWorkspace(profileId);

  if (!brainWorkspace.access) {
    return null;
  }

  const agentsByKey = await getCatalogAgentsByKey();
  const agentIds = Array.from(agentsByKey.values()).map((agent) => agent.id);
  const entitlementsByAgentId = await getEntitlementsByAgentId({
    brandId: brainWorkspace.access.brandId,
    agentIds,
  });
  const agents: AgentCatalogItem[] = catalogAgentDefinitions.map(
    (definition) => {
      const agent = agentsByKey.get(definition.key) ?? null;
      const entitlement = agent
        ? entitlementsByAgentId.get(agent.id) ?? null
        : null;
      const state = deriveAgentDisplayState({
        entitlementStatus: entitlement?.status ?? null,
        brainReady: brainWorkspace.readiness.isReady,
      });

      return {
        key: definition.key,
        slug: definition.slug,
        name: agent?.name ?? definition.name,
        description: agent?.description ?? definition.description,
        agentId: agent?.id ?? null,
        entitlementId: entitlement?.id ?? null,
        entitlementStatus: entitlement?.status ?? null,
        activatedAt: entitlement?.activated_at ?? null,
        ...state,
      };
    },
  );

  return {
    access: brainWorkspace.access,
    brainReady: brainWorkspace.readiness.isReady,
    brainReadinessMessage: brainWorkspace.readiness.message,
    agents,
  };
}

export async function getAgentCatalogDetail({
  profileId,
  agentKey,
}: {
  profileId: string;
  agentKey: string;
}) {
  const normalizedAgentKey = catalogAgentKeyFromRoute(agentKey);

  if (!normalizedAgentKey) {
    return null;
  }

  const workspace = await getAgentCatalogWorkspace(profileId);

  if (!workspace) {
    return null;
  }

  const agent =
    workspace.agents.find((item) => item.key === normalizedAgentKey) ?? null;

  return agent ? { workspace, agent } : null;
}

