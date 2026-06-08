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

// Retrieval keys off the latest question only; prior turns are supplied to the
// model purely as conversational memory so follow-ups stay grounded in the
// freshly retrieved context rather than drifting onto earlier topics.
export async function retrieveBrandBrainContext({
  prompt,
  brandId,
}: {
  prompt: string;
  brandId: string;
}) {
  const chunks = await searchBrandKnowledge({
    brandId,
    query: prompt,
    topK: 5,
  });

  const retrievedSources = toRetrievedSources(chunks);

  return {
    context: buildContextBlock(chunks),
    retrievedSources,
    displaySources: toBrandBrainDisplaySources(retrievedSources),
  };
}

type ChatMessageParam = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function buildBrandBrainMessages({
  context,
  history,
  prompt,
}: {
  context: string;
  history: BrandBrainChatMessage[];
  prompt: string;
}): ChatMessageParam[] {
  return [
    { role: "system", content: BRAIN_SYSTEM_PROMPT + context },
    ...history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    { role: "user", content: prompt },
  ];
}

export function computeBrainUsage({
  model,
  promptTokens,
  completionTokens,
}: {
  model: string;
  promptTokens: number;
  completionTokens: number;
}) {
  return {
    promptTokens,
    completionTokens,
    costCents: computeTextCostCents({ model, promptTokens, completionTokens }),
    model,
  };
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
  const { context, retrievedSources, displaySources } =
    await retrieveBrandBrainContext({ prompt, brandId });

  const client = await getOpenRouterClientForBrand(brandId);
  const completion = await client.chat.completions.create({
    model,
    messages: buildBrandBrainMessages({ context, history, prompt }),
  });

  const answer = completion.choices[0]?.message?.content?.trim() ?? "";

  return {
    responseId: completion.id ?? `pgvector-${Date.now()}`,
    answer,
    retrievedSources,
    displaySources,
    usage: computeBrainUsage({
      model,
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
    }),
  };
}

// Opens a token stream against the brand-scoped client. `include_usage` asks
// OpenRouter to append a final chunk carrying token counts so the caller can
// price the run after the answer finishes streaming.
export async function openBrandBrainStream({
  brandId,
  model,
  messages,
}: {
  brandId: string;
  model: string;
  messages: ChatMessageParam[];
}) {
  const client = await getOpenRouterClientForBrand(brandId);

  return client.chat.completions.create({
    model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  });
}
