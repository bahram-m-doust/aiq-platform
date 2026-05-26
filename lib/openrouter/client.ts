import "server-only";

import OpenAI from "openai";

import { readTrimmedRuntimeEnv } from "@/lib/env/runtime";
import { DomainError } from "@/lib/errors";

let openrouterClient: OpenAI | null = null;

const DEFAULT_MODEL = "openai/gpt-4o";

export function hasOpenRouterEnv(): boolean {
  return Boolean(readTrimmedRuntimeEnv("OPENROUTER_API_KEY"));
}

export function getOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
}

export function getOpenRouterClient(): OpenAI {
  if (openrouterClient) return openrouterClient;

  const apiKey = readTrimmedRuntimeEnv("OPENROUTER_API_KEY");
  if (!apiKey) {
    throw new DomainError(
      "openrouter_config",
      "OPENROUTER_API_KEY is required for LLM generation.",
    );
  }

  openrouterClient = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });

  return openrouterClient;
}
