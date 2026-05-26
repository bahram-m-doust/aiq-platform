import "server-only";

import { getAgentSystemPrompt } from "@/features/agents/runs/prompts";
import {
  toAgentRunDisplaySources,
} from "@/features/agents/runs/schema";
import type { AgentKnowledgeModuleScope } from "@/features/agents/runs/types";
import type { CatalogAgentKey } from "@/features/agents/catalog/types";
import { searchBrandKnowledge } from "@/features/rag/vector-search";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import {
  getOpenRouterClient,
  getOpenRouterModel,
} from "@/lib/openrouter/client";

const CODE = "openrouter_agent_run_config";

export function isLLMAgentRunConfigError(error: unknown): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}

function buildContextBlock(
  chunks: { chunkText: string; fileName: string; score: number }[],
): string {
  if (chunks.length === 0) return "";

  const sections = chunks.map(
    (c) =>
      `--- Source: ${c.fileName} (relevance: ${Math.round(c.score * 100)}%) ---\n${c.chunkText}`,
  );

  return `\n\n## Brand Knowledge Context\n\n${sections.join("\n\n")}`;
}

export function getAgentRunModel(): string {
  return getOpenRouterModel();
}

export async function createAgentRunResponse({
  agentKey,
  prompt,
  brandId,
  moduleScope,
  model = getAgentRunModel(),
}: {
  agentKey: CatalogAgentKey;
  prompt: string;
  brandId: string;
  moduleScope: AgentKnowledgeModuleScope;
  model?: string;
}) {
  const chunks = await searchBrandKnowledge({
    brandId,
    query: prompt,
    topK: 5,
    moduleIds:
      moduleScope.filteredModuleIds.length > 0
        ? moduleScope.filteredModuleIds
        : undefined,
  });

  const context = buildContextBlock(chunks);
  const systemPrompt = getAgentSystemPrompt(agentKey);

  const client = getOpenRouterClient();
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt + context },
      { role: "user", content: prompt },
    ],
  });

  const answer = completion.choices[0]?.message?.content?.trim() ?? "";

  const retrievedSources = chunks.map((c) => ({
    fileName: c.fileName,
    score: c.score,
    providerFileId: c.knowledgeFileId,
    attributes: {
      chunk_id: c.chunkId,
      knowledge_file_id: c.knowledgeFileId,
    },
  }));

  return {
    responseId: completion.id ?? `pgvector-${Date.now()}`,
    answer,
    retrievedSources,
    displaySources: toAgentRunDisplaySources(retrievedSources),
  };
}
