import "server-only";

import OpenAI from "openai";

import { getAgentSystemPrompt } from "@/features/agents/runs/prompts";
import {
  extractAgentRunSources,
  toAgentRunDisplaySources,
} from "@/features/agents/runs/schema";
import type { AgentKnowledgeModuleScope } from "@/features/agents/runs/types";
import type { CatalogAgentKey } from "@/features/agents/catalog/types";
import { readTrimmedRuntimeEnv } from "@/lib/env/runtime";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";

let openaiClient: OpenAI | null = null;

const CODE = "openai_agent_run_config";

export function isOpenAIAgentRunConfigError(
  error: unknown,
): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}

export function getAgentRunModel() {
  return (
    process.env.OPENAI_AGENT_MODEL?.trim() ||
    process.env.OPENAI_BRAIN_MODEL?.trim() ||
    "gpt-5.5"
  );
}

function getOpenAIClient() {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = readTrimmedRuntimeEnv("OPENAI_API_KEY");

  if (!apiKey) {
    throw new DomainError(
      CODE,
      "OPENAI_API_KEY is required before agents can run.",
    );
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

export async function createAgentRunResponse({
  agentKey,
  prompt,
  providerVectorStoreId,
  brandId,
  profileId,
  moduleScope,
  model = getAgentRunModel(),
}: {
  agentKey: CatalogAgentKey;
  prompt: string;
  providerVectorStoreId: string;
  brandId: string;
  profileId: string;
  moduleScope: AgentKnowledgeModuleScope;
  model?: string;
}) {
  const client = getOpenAIClient();
  const tool = {
    type: "file_search" as const,
    vector_store_ids: [providerVectorStoreId],
    max_num_results: 10,
    ...(moduleScope.filter ? { filters: moduleScope.filter } : {}),
  };
  const response = await client.responses.create({
    model,
    instructions: getAgentSystemPrompt(agentKey),
    input: prompt,
    include: ["file_search_call.results"],
    metadata: {
      brand_id: brandId,
      user_profile_id: profileId,
      agent_key: agentKey,
      product: "bextudio-platform",
      scope: "five_mvp_agents",
    },
    tools: [tool],
  });
  const retrievedSources = extractAgentRunSources(response);

  return {
    responseId: response.id,
    answer: response.output_text?.trim() || "",
    retrievedSources,
    displaySources: toAgentRunDisplaySources(retrievedSources),
  };
}

