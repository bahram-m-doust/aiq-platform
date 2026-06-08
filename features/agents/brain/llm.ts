import "server-only";

import {
  toBrandBrainDisplaySources,
} from "@/features/agents/brain/schema";
import type {
  BrandBrainChatMessage,
  BrandBrainRetrievedSource,
} from "@/features/agents/brain/types";
import { searchBrandKnowledge } from "@/features/rag/vector-search";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import {
  getOpenRouterClientForBrand,
  getOpenRouterModel,
} from "@/lib/openrouter/client";
import { computeTextCostCents } from "@/lib/openrouter/models";

const CODE = "openrouter_brain_config";

export function isLLMBrainConfigError(error: unknown): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}

const BRAIN_SYSTEM_PROMPT =
  "You are Bextudio's Brand Integrator Brain. Answer with a formal executive tone using only the provided brand knowledge context. If the context does not contain enough information to answer, say that the current Brand Brain knowledge base does not contain enough information.";

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

function toRetrievedSources(
  chunks: { chunkId: string; knowledgeFileId: string; fileName: string; score: number }[],
): BrandBrainRetrievedSource[] {
  return chunks.map((c) => ({
    fileName: c.fileName,
    score: c.score,
    providerFileId: c.knowledgeFileId,
    attributes: {
      chunk_id: c.chunkId,
      knowledge_file_id: c.knowledgeFileId,
    },
  }));
}

export function getBrandBrainModel(): string {
  return getOpenRouterModel();
}

export async function createBrandBrainResponse({
  prompt,
  brandId,
  history = [],
  model = getBrandBrainModel(),
}: {
  prompt: string;
  brandId: string;
  history?: BrandBrainChatMessage[];
  model?: string;
}) {
  // Retrieval keys off the latest question; the prior turns are supplied to the
  // model purely as conversational memory so follow-ups stay grounded in the
  // freshly retrieved context rather than drifting onto earlier topics.
  const chunks = await searchBrandKnowledge({
    brandId,
    query: prompt,
    topK: 5,
  });

  const context = buildContextBlock(chunks);

  const client = await getOpenRouterClientForBrand(brandId);
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: BRAIN_SYSTEM_PROMPT + context },
      ...history.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      { role: "user", content: prompt },
    ],
  });

  const answer = completion.choices[0]?.message?.content?.trim() ?? "";
  const retrievedSources = toRetrievedSources(chunks);

  const promptTokens = completion.usage?.prompt_tokens ?? 0;
  const completionTokens = completion.usage?.completion_tokens ?? 0;
  const costCents = computeTextCostCents({
    model,
    promptTokens,
    completionTokens,
  });

  return {
    responseId: completion.id ?? `pgvector-${Date.now()}`,
    answer,
    retrievedSources,
    displaySources: toBrandBrainDisplaySources(retrievedSources),
    usage: { promptTokens, completionTokens, costCents, model },
  };
}
