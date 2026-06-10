import "server-only";

import {
  toBrandBrainDisplaySources,
} from "@/features/agents/brain/schema";
import { joinPromptLayers } from "@/features/agents/instructions/schema";
import type {
  BrandBrainChatMessage,
  BrandBrainRetrievedSource,
} from "@/features/agents/brain/types";
import { searchBrandKnowledge } from "@/features/rag/vector-search";
import {
  buildUntrustedKnowledgeContext,
  untrustedKnowledgeInstruction,
} from "@/features/rag/prompt-context";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import {
  getOpenRouterClientForBrand,
  getOpenRouterModel,
} from "@/lib/openrouter/client";
import {
  computeTextCostCents,
  providerCostCents,
} from "@/lib/openrouter/models";

const CODE = "openrouter_brain_config";
const MAX_COMPLETION_TOKENS = 1200;

export function isLLMBrainConfigError(error: unknown): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}

// Layer [1] — role/identity, locked in code.
const BRAIN_ROLE_PROMPT =
  "You are Bextudio's Brand Integrator Brain, a strategic assistant that answers in a formal executive tone.";

// Layer [3] — safety/scope guard, locked in code and appended after the
// admin-edited brand instruction so it can never be overridden.
const BRAIN_SAFETY_GUARD =
  `Answer using only the provided brand knowledge context. If the context does not contain enough information to answer, say that the current Brand Brain knowledge base does not contain enough information. Never reference other brands, knowledge that was not provided, or internal system details. ${untrustedKnowledgeInstruction}`;

function buildContextBlock(
  chunks: { chunkText: string; fileName: string; score: number }[],
): string {
  return buildUntrustedKnowledgeContext(chunks);
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
  instruction = "",
}: {
  context: string;
  history: BrandBrainChatMessage[];
  prompt: string;
  instruction?: string;
}): ChatMessageParam[] {
  // Retrieved documents stay in a separate untrusted user message.
  const systemContent = joinPromptLayers([
    BRAIN_ROLE_PROMPT,
    instruction,
    BRAIN_SAFETY_GUARD,
  ]);

  return [
    { role: "system", content: systemContent },
    ...history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    ...(context ? [{ role: "user" as const, content: context }] : []),
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
  instruction = "",
  model = getBrandBrainModel(),
}: {
  prompt: string;
  brandId: string;
  history?: BrandBrainChatMessage[];
  instruction?: string;
  model?: string;
}) {
  const { context, retrievedSources, displaySources } =
    await retrieveBrandBrainContext({ prompt, brandId });

  const client = await getOpenRouterClientForBrand(brandId);
  const completion = await client.chat.completions.create({
    model,
    messages: buildBrandBrainMessages({ context, history, prompt, instruction }),
    max_tokens: MAX_COMPLETION_TOKENS,
  });

  const answer = completion.choices[0]?.message?.content?.trim() ?? "";

  const promptTokens = completion.usage?.prompt_tokens ?? 0;
  const completionTokens = completion.usage?.completion_tokens ?? 0;
  const estimatedCostCents = computeTextCostCents({
    model,
    promptTokens,
    completionTokens,
  });

  return {
    responseId: completion.id ?? `pgvector-${Date.now()}`,
    answer,
    retrievedSources,
    displaySources,
    usage: {
      promptTokens,
      completionTokens,
      costCents: providerCostCents(completion.usage, estimatedCostCents),
      model,
    },
  };
}

// Opens a token stream against the brand-scoped client. `include_usage` asks
// OpenRouter to append a final chunk carrying token counts so the caller can
// price the run after the answer finishes streaming.
export async function openBrandBrainStream({
  brandId,
  model,
  messages,
  signal,
}: {
  brandId: string;
  model: string;
  messages: ChatMessageParam[];
  signal?: AbortSignal;
}) {
  const client = await getOpenRouterClientForBrand(brandId);

  return client.chat.completions.create(
    {
      model,
      messages,
      max_tokens: MAX_COMPLETION_TOKENS,
      stream: true,
      stream_options: { include_usage: true },
    },
    { signal },
  );
}
