import "server-only";

import OpenAI from "openai";

import { readTrimmedRuntimeEnv } from "@/lib/env/runtime";
import { DomainError } from "@/lib/errors";

let client: OpenAI | null = null;

const EMBEDDING_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 100;

export function hasEmbeddingEnv(): boolean {
  return Boolean(readTrimmedRuntimeEnv("OPENAI_API_KEY"));
}

function getClient(): OpenAI {
  if (client) return client;

  const apiKey = readTrimmedRuntimeEnv("OPENAI_API_KEY");
  if (!apiKey) {
    throw new DomainError(
      "embedding_config",
      "OPENAI_API_KEY is required for generating embeddings.",
    );
  }

  client = new OpenAI({ apiKey });
  return client;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await getClient().embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });

    const sorted = [...response.data].sort((a, b) => a.index - b.index);
    for (const item of sorted) {
      results.push(item.embedding);
    }
  }

  return results;
}

export async function embedQuery(query: string): Promise<number[]> {
  const [embedding] = await embedTexts([query]);
  return embedding;
}
