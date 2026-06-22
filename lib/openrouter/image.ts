import "server-only";

import { getOpenRouterClientForBrand } from "@/lib/openrouter/client";
import {
  computeImageCostCents,
  providerCostCents,
  type ImageModelId,
} from "@/lib/openrouter/models";

export type GenerateImageResult = {
  b64Images: string[];
  usage: { imageCount: number; costCents: number; model: ImageModelId };
};

// OpenRouter generates images ONLY through /chat/completions with
// `modalities: ["image", "text"]`. It does not expose an OpenAI-style
// /images/generations endpoint (that path 404s). The generated image arrives
// on `choices[0].message.images[]`, each entry shaped as
// `{ image_url: { url: "data:image/png;base64,..." } }`.
// Docs: https://openrouter.ai/docs/guides/overview/multimodal/image-generation

/**
 * Generate one or more PNG images via OpenRouter.
 * Normalises the returned data URLs to raw base64 strings for PNG persistence.
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

  // OpenRouter forwards the `modalities` field to the upstream provider
  // verbatim; the OpenAI SDK types don't know about it, so we cast the payload.
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    modalities: ["image", "text"],
    n,
  } as unknown as Parameters<typeof client.chat.completions.create>[0]);

  const normalized = response as unknown as {
    choices?: Array<{
      message?: {
        images?: Array<
          { image_url?: { url?: string | null } | null } | null
        >;
      };
    }>;
    usage?: unknown;
  };
  const choices = normalized.choices ?? [];

  const dataUrls: string[] = [];
  for (const choice of choices) {
    const images = choice?.message?.images ?? [];
    for (const img of images) {
      const url = img?.image_url?.url;
      if (typeof url === "string") dataUrls.push(url);
    }
  }

  const b64Images = dataUrls
    .map(stripDataUrlPrefix)
    .filter((b): b is string => Boolean(b));
  const imageCount = b64Images.length;
  const costCents = providerCostCents(
    normalized.usage,
    computeImageCostCents({ model, imageCount }),
  );

  return {
    b64Images,
    usage: { imageCount, costCents, model },
  };
}

function stripDataUrlPrefix(value: string): string | null {
  // Accept "data:image/png;base64,XXXX" → "XXXX", and raw base64 unchanged.
  if (!value) return null;
  const marker = "base64,";
  const idx = value.indexOf(marker);
  if (idx >= 0) return value.slice(idx + marker.length);
  return value;
}
