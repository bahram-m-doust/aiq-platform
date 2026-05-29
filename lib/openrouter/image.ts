import "server-only";

import { getOpenRouterClientForBrand } from "@/lib/openrouter/client";
import {
  computeImageCostCents,
  type ImageModelId,
} from "@/lib/openrouter/models";

export type GenerateImageResult = {
  b64Images: string[];
  usage: { imageCount: number; costCents: number; model: ImageModelId };
};

/**
 * OpenRouter supports OpenAI-compatible `/images/generations` for several
 * image models. Returns base64 PNGs so the caller can persist to storage.
 */
export async function generateImage({
  brandId,
  model,
  prompt,
  n = 1,
}: {
  brandId: string;
  model: ImageModelId;
  prompt: string;
  n?: number;
}): Promise<GenerateImageResult> {
  const client = await getOpenRouterClientForBrand(brandId);
  // The OpenAI SDK's images.generate is OpenAI-typed; OpenRouter accepts
  // arbitrary model ids, so we cast through `unknown` to satisfy TS.
  const response = await client.images.generate({
    model,
    prompt,
    n,
    response_format: "b64_json",
  } as unknown as Parameters<typeof client.images.generate>[0]);

  const data =
    (response as unknown as { data?: Array<{ b64_json?: string | null }> })
      .data ?? [];

  const b64Images: string[] = data
    .map((d) => d?.b64_json ?? null)
    .filter((b): b is string => Boolean(b));

  const imageCount = b64Images.length;
  const costCents = computeImageCostCents({ model, imageCount });

  return {
    b64Images,
    usage: { imageCount, costCents, model },
  };
}
