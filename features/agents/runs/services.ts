import "server-only";

import { getBrandBrainWorkspace } from "@/features/agents/brain/queries";
import {
  canActivateAgentRole,
  catalogAgentKeyFromRoute,
} from "@/features/agents/catalog/schema";
import type { CatalogAgentKey } from "@/features/agents/catalog/types";
import { createAgentRunResponse, getAgentRunModel } from "@/features/agents/runs/llm";
import {
  agentRunProvider,
  buildAgentKnowledgeModuleScope,
  parseRequiredModuleTypes,
  toAgentRunAuditMetadata,
} from "@/features/agents/runs/schema";
import type {
  AgentKnowledgeModuleScope,
  AgentRunResult,
} from "@/features/agents/runs/types";
import type { UserProfile } from "@/features/auth/types";
import { logAudit } from "@/lib/audit/logAudit";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

type AgentRunContextRow = {
  id: string;
  key: string;
  name: string;
  required_modules: unknown;
};

type EntitlementRow = {
  id: string;
  status: string;
};

type ModuleRow = {
  id: string;
};

type KnowledgeFileRow = {
  module_id: string | null;
};

type AgentRunRow = {
  id: string;
};

const CODE = "agent_run_service";

export function isAgentRunServiceError(error: unknown): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}

function runError(message: string): never {
  throw new DomainError(CODE, message);
}

async function getAgentRunContext(agentKey: CatalogAgentKey) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agents")
    .select("id, key, name, required_modules")
    .eq("key", agentKey)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as AgentRunContextRow | null;
}

async function getAgentEntitlement({
  brandId,
  agentId,
}: {
  brandId: string;
  agentId: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agent_entitlements")
    .select("id, status")
    .eq("brand_id", brandId)
    .eq("agent_id", agentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as EntitlementRow | null;
}

async function getSyncedModuleIdsForRequiredModules({
  brandId,
  requiredModuleTypes,
}: {
  brandId: string;
  requiredModuleTypes: string[];
}) {
  if (requiredModuleTypes.length === 0) {
    return [];
  }

  const admin = createAdminClient();
  const { data: modulesData, error: modulesError } = await admin
    .from("brand_modules")
    .select("id")
    .eq("brand_id", brandId)
    .in("module_type", requiredModuleTypes);

  if (modulesError) {
    throw modulesError;
  }

  const moduleIds = ((modulesData ?? []) as ModuleRow[]).map(
    (module) => module.id,
  );

  if (moduleIds.length === 0) {
    return [];
  }

  const { data: knowledgeData, error: knowledgeError } = await admin
    .from("knowledge_files")
    .select("module_id")
    .eq("brand_id", brandId)
    .eq("rag_status", "RAG_SYNCED")
    .in("module_id", moduleIds);

  if (knowledgeError) {
    throw knowledgeError;
  }

  return Array.from(
    new Set(
      ((knowledgeData ?? []) as KnowledgeFileRow[])
        .map((row) => row.module_id)
        .filter((moduleId): moduleId is string => Boolean(moduleId)),
    ),
  );
}

async function resolveKnowledgeModuleScope({
  brandId,
  requiredModules,
}: {
  brandId: string;
  requiredModules: unknown;
}): Promise<AgentKnowledgeModuleScope> {
  const requiredModuleTypes = parseRequiredModuleTypes(requiredModules);
  const syncedModuleIds = await getSyncedModuleIdsForRequiredModules({
    brandId,
    requiredModuleTypes,
  });

  if (requiredModuleTypes.length > 0 && syncedModuleIds.length === 0) {
    runError(
      "No synced knowledge files are available for this agent's mapped modules.",
    );
  }

  return buildAgentKnowledgeModuleScope({
    requiredModuleTypes,
    syncedModuleIds,
  });
}

async function insertAgentRun({
  brandId,
  agentId,
  userId,
  agentKey,
  prompt,
  answer,
  responseId,
  model,
  retrievedSources,
  moduleScope,
  latencyMs,
}: {
  brandId: string;
  agentId: string;
  userId: string;
  agentKey: CatalogAgentKey;
  prompt: string;
  answer: string;
  responseId: string;
  model: string;
  retrievedSources: unknown[];
  moduleScope: AgentKnowledgeModuleScope;
  latencyMs: number;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agent_runs")
    .insert({
      brand_id: brandId,
      agent_id: agentId,
      user_id: userId,
      input: {
        prompt,
        agent_key: agentKey,
        required_modules: moduleScope.requiredModuleTypes,
        filtered_module_ids: moduleScope.filteredModuleIds,
      },
      output: { answer, response_id: responseId },
      provider: agentRunProvider,
      model,
      retrieved_sources: retrievedSources,
      cost: null,
      latency_ms: latencyMs,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return (data as AgentRunRow).id;
}

async function insertAgentRunAudit({
  profile,
  brandId,
  agentId,
  agentKey,
  runId,
  model,
}: {
  profile: UserProfile;
  brandId: string;
  agentId: string;
  agentKey: CatalogAgentKey;
  runId: string;
  model: string;
}) {
  const metadata = toAgentRunAuditMetadata({
    brandId,
    agentId,
    agentKey,
    runId,
    userId: profile.id,
    model,
  });
  await logAudit({
    actorUserId: profile.id,
    actorRole: profile.global_role,
    brandId,
    action: "agent_run_created",
    entityType: "agent_run",
    entityId: runId,
    before: null,
    after: metadata,
  });
}

export async function runCatalogAgent({
  profile,
  agentKey,
  prompt,
}: {
  profile: UserProfile;
  agentKey: CatalogAgentKey;
  prompt: string;
}): Promise<AgentRunResult> {
  const normalizedAgentKey = catalogAgentKeyFromRoute(agentKey) ?? agentKey;
  const [brainWorkspace, agent] = await Promise.all([
    getBrandBrainWorkspace(profile.id),
    getAgentRunContext(normalizedAgentKey),
  ]);

  if (!brainWorkspace.access) {
    runError("Active brand access is required to run agents.");
  }

  if (!canActivateAgentRole(brainWorkspace.access.membershipRole)) {
    runError("Only Owners and Executive Managers can run agents.");
  }

  if (!brainWorkspace.readiness.isReady) {
    runError(brainWorkspace.readiness.message);
  }

  if (!agent) {
    runError("This agent is not configured for runs.");
  }

  const entitlement = await getAgentEntitlement({
    brandId: brainWorkspace.access.brandId,
    agentId: agent.id,
  });

  if (!entitlement) {
    runError("This agent is not included in the current plan.");
  }

  if (entitlement.status !== "ACTIVE") {
    runError("This agent must be activated before it can run.");
  }

  const moduleScope = await resolveKnowledgeModuleScope({
    brandId: brainWorkspace.access.brandId,
    requiredModules: agent.required_modules,
  });
  const model = getAgentRunModel();
  const startedAt = Date.now();
  const response = await createAgentRunResponse({
    agentKey: normalizedAgentKey,
    prompt,
    brandId: brainWorkspace.access.brandId,
    moduleScope,
    model,
  });
  const latencyMs = Math.max(0, Date.now() - startedAt);

  if (!response.answer) {
    runError("The agent did not return an answer.");
  }

  const runId = await insertAgentRun({
    brandId: brainWorkspace.access.brandId,
    agentId: agent.id,
    userId: profile.id,
    agentKey: normalizedAgentKey,
    prompt,
    answer: response.answer,
    responseId: response.responseId,
    model,
    retrievedSources: response.retrievedSources,
    moduleScope,
    latencyMs,
  });

  await insertAgentRunAudit({
    profile,
    brandId: brainWorkspace.access.brandId,
    agentId: agent.id,
    agentKey: normalizedAgentKey,
    runId,
    model,
  });

  return {
    runId,
    answer: response.answer,
    sources: response.displaySources,
    model,
  };
}
