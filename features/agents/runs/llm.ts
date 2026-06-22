import "server-only";

import { getAgentSystemPrompt } from "@/features/agents/runs/prompts";
import {
  toAgentRunDisplaySources,
} from "@/features/agents/runs/schema";
import type { AgentKnowledgeModuleScope } from "@/features/agents/runs/types";
import type { CatalogAgentKey } from "@/features/agents/catalog/types";
import {
  buildUntrustedKnowledgeContext,
  untrustedKnowledgeInstruction,
} from "@/features/rag/prompt-context";
import { joinPromptLayers } from "@/features/agents/instructions/schema";
import { searchBrandKnowledge } from "@/features/rag/vector-search";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import {
  getOpenRouterClientForBrand,
  getOpenRouterModel,
} from "@/lib/openrouter/client";
import {
  computeTextCostCents,
  providerCostCents,
} from "@/lib/openrouter/models";

const CODE = "openrouter_agent_run_config";
const MAX_COMPLETION_TOKENS = 1200;
const MAX_IMAGE_PROMPT_TOKENS = 250;

export function isLLMAgentRunConfigError(error: unknown): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}

function buildContextBlock(
  chunks: { chunkText: string; fileName: string; score: number }[],
): string {
  return buildUntrustedKnowledgeContext(chunks);
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

  const client = await getOpenRouterClientForBrand(brandId);
  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `${systemPrompt}\n\n${untrustedKnowledgeInstruction}`,
      },
      ...(context ? [{ role: "user" as const, content: context }] : []),
      { role: "user", content: prompt },
    ],
    max_tokens: MAX_COMPLETION_TOKENS,
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

  const promptTokens = completion.usage?.prompt_tokens ?? 0;
  const completionTokens = completion.usage?.completion_tokens ?? 0;
  const estimatedCostCents = computeTextCostCents({
    model,
    promptTokens,
    completionTokens,
  });
  const costCents = providerCostCents(completion.usage, estimatedCostCents);

  return {
    responseId: completion.id ?? `pgvector-${Date.now()}`,
    answer,
    retrievedSources,
    displaySources: toAgentRunDisplaySources(retrievedSources),
    usage: { promptTokens, completionTokens, costCents, model },
  };
}

// Layer [1] — task definition, locked in code.
const IMAGE_REWRITE_TASK =
  "You are a brand-side art director. Convert the user's request into ONE precise, on-brand image-generation prompt for a text-to-image model. " +
  "Output ONLY the final prompt text — no preamble, no commentary, no markdown, no quotes. Keep it under 120 words.";

// Layer [3] — visual extraction guide + safety, appended after the brand instruction.
const IMAGE_REWRITE_VISUAL_GUARD =
  "Extract and apply every visual rule from the brand instruction above: exact color codes or palette, " +
  "composition style, photography guidelines (including any required prefix or suffix), subjects, mood, and overall aesthetic. " +
  "If the brand instruction specifies a photography or image style rule, embed it directly in the output prompt. " +
  `${untrustedKnowledgeInstruction}`;

export async function rewritePromptForImage({
  brandId,
  brandPrompt,
  model,
  brandContext,
  instruction = "",
}: {
  brandId: string;
  brandPrompt: string;
  model: string;
  brandContext: string;
  instruction?: string;
}) {
  // Mirror the chat 3-layer assembly: neutral task → brand instruction → visual guard.
  const systemContent = joinPromptLayers([
    IMAGE_REWRITE_TASK,
    instruction,
    IMAGE_REWRITE_VISUAL_GUARD,
  ]);

  const client = await getOpenRouterClientForBrand(brandId);
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemContent },
      ...(brandContext
        ? [{ role: "user" as const, content: brandContext }]
        : []),
      { role: "user", content: brandPrompt },
    ],
    max_tokens: MAX_IMAGE_PROMPT_TOKENS,
  });

  const optimized = completion.choices[0]?.message?.content?.trim() ?? brandPrompt;
  const promptTokens = completion.usage?.prompt_tokens ?? 0;
  const completionTokens = completion.usage?.completion_tokens ?? 0;
  const estimatedCostCents = computeTextCostCents({
    model,
    promptTokens,
    completionTokens,
  });
  const costCents = providerCostCents(completion.usage, estimatedCostCents);

  return {
    optimizedPrompt: optimized,
    usage: { promptTokens, completionTokens, costCents, model },
  };
}

export function buildBrandContextBlock(
  chunks: { chunkText: string; fileName: string; score: number }[],
) {
  return buildContextBlock(chunks);
}
