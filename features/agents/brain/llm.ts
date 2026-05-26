import "server-only";

import {
  toBrandBrainDisplaySources,
} from "@/features/agents/brain/schema";
import type { BrandBrainRetrievedSource } from "@/features/agents/brain/types";
import { searchBrandKnowledge } from "@/features/rag/vector-search";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import {
  getOpenRouterClient,
  getOpenRouterModel,
} from "@/lib/openrouter/client";

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
  model = getBrandBrainModel(),
}: {
  prompt: string;
  brandId: string;
  model?: string;
}) {
  const chunks = await searchBrandKnowledge({
    brandId,
    query: prompt,
    topK: 5,
  });

  const context = buildContextBlock(chunks);

  const client = getOpenRouterClient();
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: BRAIN_SYSTEM_PROMPT + context },
      { role: "user", content: prompt },
    ],
  });

  const answer = completion.choices[0]?.message?.content?.trim() ?? "";
  const retrievedSources = toRetrievedSources(chunks);

  return {
    responseId: completion.id ?? `pgvector-${Date.now()}`,
    answer,
    retrievedSources,
    displaySources: toBrandBrainDisplaySources(retrievedSources),
  };
}
