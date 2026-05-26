import "server-only";

import {
  getOpenRouterClientForBrand,
  hasOpenRouterEnv,
} from "@/lib/openrouter/client";

const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const BATCH_SIZE = 100;

export function hasEmbeddingEnv(): boolean {
  return hasOpenRouterEnv();
}

export async function embedTexts(
  texts: string[],
  brandId: string,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = await getOpenRouterClientForBrand(brandId);
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await client.embeddings.create({
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

export async function embedQuery(
  query: string,
  brandId: string,
): Promise<number[]> {
  const [embedding] = await embedTexts([query], brandId);
  return embedding;
}
