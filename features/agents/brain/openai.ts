import "server-only";

import OpenAI from "openai";

import {
  extractBrandBrainSources,
  toBrandBrainDisplaySources,
} from "@/features/agents/brain/schema";

let openaiClient: OpenAI | null = null;

export class OpenAIBrainConfigError extends Error {
  name = "OpenAIBrainConfigError";
}

export function isOpenAIBrainConfigError(
  error: unknown,
): error is OpenAIBrainConfigError {
  return error instanceof OpenAIBrainConfigError;
}

export function getBrandBrainModel() {
  return process.env.OPENAI_BRAIN_MODEL?.trim() || "gpt-5.5";
}

function getOpenAIClient() {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new OpenAIBrainConfigError(
      "OPENAI_API_KEY is required before Brand Brain can run.",
    );
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

export async function createBrandBrainResponse({
  prompt,
  providerVectorStoreId,
  brandId,
  profileId,
  model = getBrandBrainModel(),
}: {
  prompt: string;
  providerVectorStoreId: string;
  brandId: string;
  profileId: string;
  model?: string;
}) {
  const client = getOpenAIClient();
  const response = await client.responses.create({
    model,
    instructions:
      "You are Bextudio's Brand Integrator Brain. Answer with a formal executive tone using only the current brand knowledge base available through file search. If the available brand knowledge does not support an answer, say that the current Brand Brain knowledge base does not contain enough information.",
    input: prompt,
    include: ["file_search_call.results"],
    metadata: {
      brand_id: brandId,
      user_profile_id: profileId,
      product: "bextudio-platform",
      scope: "brand_integrator_brain_mvp",
    },
    tools: [
      {
        type: "file_search",
        vector_store_ids: [providerVectorStoreId],
        max_num_results: 10,
      },
    ],
  });
  const retrievedSources = extractBrandBrainSources(response);

  return {
    responseId: response.id,
    answer: response.output_text?.trim() || "",
    retrievedSources,
    displaySources: toBrandBrainDisplaySources(retrievedSources),
  };
}
