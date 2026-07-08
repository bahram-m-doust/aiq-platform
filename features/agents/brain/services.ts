import "server-only";

import type { UserProfile } from "@/features/auth/types";
import {
  buildBrandBrainMessages,
  createBrandBrainResponse,
  getBrandBrainModel,
  type BrandBrainInputMessage,
} from "@/features/agents/brain/llm";
import { getBrandBrainWorkspace } from "@/features/agents/brain/queries";
import { getBrandAgentInstruction } from "@/features/agents/instructions/queries";
import {
  brandBrainProvider,
  toAgentRunAuditMetadata,
} from "@/features/agents/brain/schema";
import type {
  BrandBrainChatMessage,
  BrandBrainRetrievedSource,
  BrandBrainRunResult,
} from "@/features/agents/brain/types";
import {
  attachRunUsage,
  recordRunUsage,
  releaseRunUsageReservation,
  reserveRunUsage,
  type UsageReservation,
} from "@/features/openrouter/usage";
import { logAudit } from "@/lib/audit/logAudit";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

type AgentRunRow = {
  id: string;
};

const CODE = "brand_brain_service";

export function isBrandBrainServiceError(error: unknown): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}

function brainError(message: string): never {
  throw new DomainError(CODE, message);
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
  sessionId,
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
  sessionId?: string | null;
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
      ...(sessionId ? { session_id: sessionId } : {}),
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

// Shared persistence tail for both the blocking and streaming code paths: store
// the run, meter usage/cost, and write the (content-free) audit entry.
export async function finalizeBrandBrainRun({
  profile,
  brandId,
  agentId,
  model,
  prompt,
  answer,
  responseId,
  retrievedSources,
  usage,
  reservation,
  latencyMs,
  sessionId,
}: {
  profile: UserProfile;
  brandId: string;
  agentId: string;
  model: string;
  prompt: string;
  answer: string;
  responseId: string;
  retrievedSources: BrandBrainRetrievedSource[];
  usage: { promptTokens: number; completionTokens: number; costCents: number };
  reservation: UsageReservation;
  latencyMs: number;
  sessionId?: string | null;
}): Promise<string> {
  const usageId = await recordRunUsage({
    reservation,
    kind: "TEXT",
    model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    costCents: usage.costCents,
  });

  const runId = await insertAgentRun({
    brandId,
    agentId,
    userId: profile.id,
    prompt,
    answer,
    responseId,
    model,
    retrievedSources,
    latencyMs,
    sessionId,
  });

  await attachRunUsage({ runId, usageIds: [usageId] });

  await insertAgentRunAudit({ profile, brandId, agentId, runId, model });

  return runId;
}

export async function runBrandBrain({
  profile,
  prompt,
  history = [],
}: {
  profile: UserProfile;
  prompt: string;
  history?: BrandBrainChatMessage[];
}): Promise<BrandBrainRunResult> {
  const workspace = await getBrandBrainWorkspace(profile.id);
  const { access, agent, readiness } = workspace;

  if (!access || !agent || !readiness.isReady) {
    brainError(readiness.message);
  }

  const instruction = await getBrandAgentInstruction({
    brandId: access.brandId,
    agentId: agent.id,
  });
  const model = getBrandBrainModel();
  const reservation = await reserveRunUsage({
    brandId: access.brandId,
    kind: "TEXT",
  });
  const startedAt = Date.now();
  try {
    const response = await createBrandBrainResponse({
      prompt,
      history,
      instruction,
      brandId: access.brandId,
      model,
    });
    const latencyMs = Math.max(0, Date.now() - startedAt);

    if (!response.answer) {
      brainError("Brand Brain did not return an answer.");
    }

    const runId = await finalizeBrandBrainRun({
      profile,
      brandId: access.brandId,
      agentId: agent.id,
      model,
      prompt,
      answer: response.answer,
      responseId: response.responseId,
      retrievedSources: response.retrievedSources,
      usage: response.usage,
      reservation,
      latencyMs,
    });

    return {
      runId,
      answer: response.answer,
      sources: response.displaySources,
      model,
    };
  } catch (error) {
    await releaseRunUsageReservation(reservation).catch(() => undefined);
    throw error;
  }
}

export type BrandBrainStreamPlan = {
  brandId: string;
  agentId: string;
  model: string;
  vectorStoreId: string;
  instruction: string;
  messages: BrandBrainInputMessage[];
  startedAt: number;
  reservation: UsageReservation;
};

// Gate, retrieve, and assemble everything the streaming route needs before it
// opens the token stream. Mirrors runBrandBrain's preconditions (readiness +
// budget) so the streaming path enforces the same access rules.
export async function prepareBrandBrainStream({
  profile,
  prompt,
  history,
}: {
  profile: UserProfile;
  prompt: string;
  history: BrandBrainChatMessage[];
}): Promise<BrandBrainStreamPlan> {
  const workspace = await getBrandBrainWorkspace(profile.id);
  const { access, agent, readiness } = workspace;

  if (!access || !agent || !readiness.isReady) {
    brainError(readiness.message);
  }

  const instruction = await getBrandAgentInstruction({
    brandId: access.brandId,
    agentId: agent.id,
  });
  const model = getBrandBrainModel();
  const vectorStoreId = readiness.providerVectorStoreId;

  if (!vectorStoreId) {
    brainError("OpenAI vector store is not configured for this brand.");
  }

  const reservation = await reserveRunUsage({
    brandId: access.brandId,
    kind: "TEXT",
  });

  return {
    brandId: access.brandId,
    agentId: agent.id,
    model,
    vectorStoreId,
    instruction,
    messages: buildBrandBrainMessages({ history, prompt }),
    startedAt: Date.now(),
    reservation,
  };
}
