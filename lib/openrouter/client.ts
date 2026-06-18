import "server-only";

import OpenAI from "openai";

import { getBrandApiKey } from "@/features/brands/api-keys";
import { readTrimmedRuntimeEnv } from "@/lib/env/runtime";
import { DomainError } from "@/lib/errors";
import {
  coerceTextModel,
  DEFAULT_TEXT_MODEL,
  type TextModelId,
} from "@/lib/openrouter/models";

let globalClient: OpenAI | null = null;
const brandClients = new Map<string, OpenAI>();

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// The OpenAI SDK defaults to a 600s timeout with 2 retries; under load a hung
// upstream would hold a serverless invocation (and its DB connection / usage
// reservation) open for up to ~30 minutes. Cap each request instead. Streaming
// chat inherits this generous ceiling; non-streaming hot paths (embeddings,
// agent runs) finish well under it. Per-call `{ timeout }` overrides still win
// (e.g. pdf-to-markdown uses a tighter 60s).
const OPENROUTER_REQUEST_TIMEOUT_MS = 120_000;
const OPENROUTER_MAX_RETRIES = 2;

export function hasOpenRouterEnv(): boolean {
  return Boolean(readTrimmedRuntimeEnv("OPENROUTER_API_KEY"));
}

export function getOpenRouterModel(): TextModelId {
  return coerceTextModel(
    process.env.OPENROUTER_MODEL?.trim() || DEFAULT_TEXT_MODEL,
  );
}

export function getOpenRouterClient(): OpenAI {
  if (globalClient) return globalClient;

  const apiKey = readTrimmedRuntimeEnv("OPENROUTER_API_KEY");
  if (!apiKey) {
    throw new DomainError(
      "openrouter_config",
      "OPENROUTER_API_KEY is required for LLM and embedding services.",
    );
  }

  globalClient = new OpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey,
    timeout: OPENROUTER_REQUEST_TIMEOUT_MS,
    maxRetries: OPENROUTER_MAX_RETRIES,
  });
  return globalClient;
}

export async function getOpenRouterClientForBrand(
  brandId: string,
): Promise<OpenAI> {
  const cached = brandClients.get(brandId);
  if (cached) return cached;

  const brandKey = await getBrandApiKey(brandId);
  if (!brandKey) return getOpenRouterClient();

  const client = new OpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey: brandKey,
    timeout: OPENROUTER_REQUEST_TIMEOUT_MS,
    maxRetries: OPENROUTER_MAX_RETRIES,
  });
  brandClients.set(brandId, client);
  return client;
}

export function clearBrandClientCache(brandId: string): void {
  brandClients.delete(brandId);
}
