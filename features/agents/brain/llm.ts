import "server-only";

import {
  extractBrandBrainSources,
  toBrandBrainDisplaySources,
} from "@/features/agents/brain/schema";
import { joinPromptLayers } from "@/features/agents/instructions/schema";
import type {
  BrandBrainChatMessage,
} from "@/features/agents/brain/types";
import {
  getBrandOpenAIVectorStore,
  searchOpenAIBrandKnowledge,
} from "@/features/rag/openai-file-search";
import { untrustedKnowledgeInstruction } from "@/features/rag/prompt-context";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import {
  getOpenAIClient,
  getOpenAIModel,
  isOpenAIConfigError,
} from "@/lib/openai/client";
import { computeOpenAITextCostCents } from "@/lib/openai/models";

const CODE = "openai_brain_config";
const MAX_COMPLETION_TOKENS = 1200;

export function isLLMBrainConfigError(error: unknown): error is DomainError {
  return isDomainErrorWithCode(error, CODE) || isOpenAIConfigError(error);
}

const BRAIN_ROLE_PROMPT =
  "You are this brand's dedicated AI Brand Brain - an expert, brand-side assistant. The brand instruction that follows is your primary operating guide: apply it fully and stay in character. Reply in the user's language, be precise and well-structured, and give expert brand judgment rather than generic advice.";

const BRAIN_SAFETY_GUARD =
  `Use OpenAI file_search over the current brand's vector store as the only external brand knowledge source. If file_search does not return enough information to answer, say that the current Brand Brain knowledge base does not contain enough information. Never reference other brands, knowledge that was not retrieved, or internal system details. ${untrustedKnowledgeInstruction}`;

export type BrandBrainInputMessage = {
  role: "user" | "assistant";
  content: string;
};

export type BrandBrainDeveloperMessage = {
  role: "developer";
  content: Array<{ type: "input_text"; text: string }>;
};

export function getBrandBrainModel(): string {
  return getOpenAIModel();
}

// Image mode still needs a text context block for its prompt rewrite. This uses
// OpenAI Vector Store search directly, not local pgvector.
export async function retrieveBrandBrainContext({
  prompt,
  brandId,
  topK = 5,
}: {
  prompt: string;
  brandId: string;
  topK?: number;
}) {
  return searchOpenAIBrandKnowledge({ brandId, query: prompt, topK });
}

export function buildBrandBrainInstructions({
  instruction = "",
}: {
  instruction?: string;
} = {}) {
  return joinPromptLayers([BRAIN_ROLE_PROMPT, instruction, BRAIN_SAFETY_GUARD]);
}

export function buildBrandBrainMessages({
  history,
  prompt,
}: {
  history: BrandBrainChatMessage[];
  prompt: string;
}): BrandBrainInputMessage[] {
  return [
    ...history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    { role: "user" as const, content: prompt },
  ];
}

export function buildBrandBrainDeveloperMessage({
  instruction = "",
}: {
  instruction?: string;
} = {}): BrandBrainDeveloperMessage {
  return {
    role: "developer",
    content: [
      {
        type: "input_text",
        text: buildBrandBrainInstructions({ instruction }),
      },
    ],
  };
}

export function buildBrandBrainInput({
  history,
  prompt,
  instruction = "",
}: {
  history: BrandBrainChatMessage[];
  prompt: string;
  instruction?: string;
}): Array<BrandBrainDeveloperMessage | BrandBrainInputMessage> {
  return [
    buildBrandBrainDeveloperMessage({ instruction }),
    ...buildBrandBrainMessages({ history, prompt }),
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
    costCents: computeOpenAITextCostCents({
      model,
      promptTokens,
      completionTokens,
    }),
    model,
  };
}

function usageFromResponse(response: unknown) {
  if (!response || typeof response !== "object") {
    return { promptTokens: 0, completionTokens: 0 };
  }

  const usage = (response as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") {
    return { promptTokens: 0, completionTokens: 0 };
  }

  const promptTokens = (usage as { input_tokens?: unknown }).input_tokens;
  const completionTokens = (usage as { output_tokens?: unknown }).output_tokens;

  return {
    promptTokens:
      typeof promptTokens === "number" && Number.isFinite(promptTokens)
        ? promptTokens
        : 0,
    completionTokens:
      typeof completionTokens === "number" && Number.isFinite(completionTokens)
        ? completionTokens
        : 0,
  };
}

function outputTextFromResponse(response: unknown) {
  if (!response || typeof response !== "object") return "";
  const outputText = (response as { output_text?: unknown }).output_text;
  return typeof outputText === "string" ? outputText.trim() : "";
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
  const vectorStore = await getBrandOpenAIVectorStore({ brandId });
  if (!vectorStore?.vectorStoreId) {
    throw new DomainError(
      CODE,
      "OpenAI vector store is not configured for this brand.",
    );
  }

  const client = await getOpenAIClient();
  const response = await client.responses.create({
    model,
    input: buildBrandBrainInput({ history, prompt, instruction }),
    max_output_tokens: MAX_COMPLETION_TOKENS,
    tools: [
      {
        type: "file_search",
        vector_store_ids: [vectorStore.vectorStoreId],
        max_num_results: 8,
      },
    ],
    include: ["file_search_call.results"],
    store: false,
  });

  const answer = outputTextFromResponse(response);
  const retrievedSources = extractBrandBrainSources(response);
  const { promptTokens, completionTokens } = usageFromResponse(response);

  return {
    responseId: response.id ?? `openai-${Date.now()}`,
    answer,
    retrievedSources,
    displaySources: toBrandBrainDisplaySources(retrievedSources),
    usage: computeBrainUsage({ model, promptTokens, completionTokens }),
  };
}

export async function openBrandBrainStream({
  vectorStoreId,
  model,
  messages,
  instruction = "",
  signal,
}: {
  vectorStoreId: string;
  model: string;
  messages: BrandBrainInputMessage[];
  instruction?: string;
  signal?: AbortSignal;
}) {
  const client = await getOpenAIClient();

  return client.responses.create(
    {
      model,
      input: [
        buildBrandBrainDeveloperMessage({ instruction }),
        ...messages,
      ],
      max_output_tokens: MAX_COMPLETION_TOKENS,
      tools: [
        {
          type: "file_search",
          vector_store_ids: [vectorStoreId],
          max_num_results: 8,
        },
      ],
      include: ["file_search_call.results"],
      store: false,
      stream: true,
    },
    { signal },
  );
}

export function getUsageFromOpenAIResponse(response: unknown) {
  return usageFromResponse(response);
}

export function getOpenAIResponseOutputText(response: unknown) {
  return outputTextFromResponse(response);
}
