import "server-only";

import type { UserProfile } from "@/features/auth/types";
import {
  createBrandBrainResponse,
  getBrandBrainModel,
} from "@/features/agents/brain/openai";
import { getBrandBrainWorkspace } from "@/features/agents/brain/queries";
import {
  brandBrainProvider,
  toAgentRunAuditMetadata,
} from "@/features/agents/brain/schema";
import type { BrandBrainRunResult } from "@/features/agents/brain/types";
import { logAudit } from "@/lib/audit/logAudit";
import { createAdminClient } from "@/lib/supabase/admin";

type AgentRunRow = {
  id: string;
};

export class BrandBrainServiceError extends Error {
  name = "BrandBrainServiceError";
}

export function isBrandBrainServiceError(
  error: unknown,
): error is BrandBrainServiceError {
  return error instanceof BrandBrainServiceError;
}

function brainError(message: string): never {
  throw new BrandBrainServiceError(message);
}

async function insertAgentRun({
  brandId,
  agentId,
  userId,
  prompt,
  answer,
  responseId,
  model,
  retrievedSources,
  latencyMs,
}: {
  brandId: string;
  agentId: string;
  userId: string;
  prompt: string;
  answer: string;
  responseId: string;
  model: string;
  retrievedSources: unknown[];
  latencyMs: number;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agent_runs")
    .insert({
      brand_id: brandId,
      agent_id: agentId,
      user_id: userId,
      input: { prompt },
      output: { answer, response_id: responseId },
      provider: brandBrainProvider,
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
  runId,
  model,
}: {
  profile: UserProfile;
  brandId: string;
  agentId: string;
  runId: string;
  model: string;
}) {
  const metadata = toAgentRunAuditMetadata({
    brandId,
    agentId,
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

export async function runBrandBrain({
  profile,
  prompt,
}: {
  profile: UserProfile;
  prompt: string;
}): Promise<BrandBrainRunResult> {
  const workspace = await getBrandBrainWorkspace(profile.id);
  const { access, agent, readiness } = workspace;

  if (!access || !agent || !readiness.isReady) {
    brainError(readiness.message);
  }

  const providerVectorStoreId =
    readiness.providerVectorStoreId ??
    brainError("Brand Brain vector store is not ready.");
  const model = getBrandBrainModel();
  const startedAt = Date.now();
  const response = await createBrandBrainResponse({
    prompt,
    providerVectorStoreId,
    brandId: access.brandId,
    profileId: profile.id,
    model,
  });
  const latencyMs = Math.max(0, Date.now() - startedAt);

  if (!response.answer) {
    brainError("Brand Brain did not return an answer.");
  }

  const runId = await insertAgentRun({
    brandId: access.brandId,
    agentId: agent.id,
    userId: profile.id,
    prompt,
    answer: response.answer,
    responseId: response.responseId,
    model,
    retrievedSources: response.retrievedSources,
    latencyMs,
  });

  await insertAgentRunAudit({
    profile,
    brandId: access.brandId,
    agentId: agent.id,
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
