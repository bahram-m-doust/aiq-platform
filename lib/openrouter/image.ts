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

// Multimodal chat models (GPT-5.4 Image 2, GPT-5 Image, etc.) on OpenRouter
// only expose image output through /chat/completions with modalities, not
// through the legacy /images/generations endpoint that gpt-image-1 and the
// dedicated image models use.
const CHAT_COMPLETIONS_IMAGE_MODELS = new Set<ImageModelId>([
  "openai/gpt-5.4-image-2",
]);

/**
 * Generate one or more PNG images via OpenRouter.
 *
 * Two transports depending on model family:
 *   1. /images/generations (OpenAI-compatible) — used by gpt-image-1,
 *      gemini-2.5-flash-image, seedream-4.0. Returns `data[].b64_json`.
 *   2. /chat/completions with modalities: ["image", "text"] — used by the
 *      multimodal GPT-5.x Image series. Returns `choices[0].message.images[]`
 *      where each entry is `{ image_url: { url: "data:image/png;base64,..." } }`.
 *
 * Both paths normalize to raw base64 strings so callers can persist as PNG.
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

  const b64Images = CHAT_COMPLETIONS_IMAGE_MODELS.has(model)
    ? await generateViaChatCompletions(client, model, prompt, n)
    : await generateViaImagesEndpoint(client, model, prompt, n);

  const imageCount = b64Images.length;
  const costCents = computeImageCostCents({ model, imageCount });

  return {
    b64Images,
    usage: { imageCount, costCents, model },
  };
}

async function generateViaImagesEndpoint(
  client: Awaited<ReturnType<typeof getOpenRouterClientForBrand>>,
  model: ImageModelId,
  prompt: string,
  n: number,
): Promise<string[]> {
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

  return data
    .map((d) => d?.b64_json ?? null)
    .filter((b): b is string => Boolean(b));
}

async function generateViaChatCompletions(
  client: Awaited<ReturnType<typeof getOpenRouterClientForBrand>>,
  model: ImageModelId,
  prompt: string,
  n: number,
): Promise<string[]> {
  // OpenRouter's chat.completions accepts a `modalities` field that the OpenAI
  // SDK types do not know about. Cast the payload to bypass the type check;
  // OpenRouter forwards the param to the upstream provider verbatim.
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    modalities: ["image", "text"],
    n,
  } as unknown as Parameters<typeof client.chat.completions.create>[0]);

  const choices =
    (response as unknown as {
      choices?: Array<{
        message?: {
          images?: Array<
            { image_url?: { url?: string | null } | null } | null
          >;
        };
      }>;
    }).choices ?? [];

  const dataUrls: string[] = [];
  for (const choice of choices) {
    const images = choice?.message?.images ?? [];
    for (const img of images) {
      const url = img?.image_url?.url;
      if (typeof url === "string") dataUrls.push(url);
    }
  }

  return dataUrls
    .map(stripDataUrlPrefix)
    .filter((b): b is string => Boolean(b));
}

function stripDataUrlPrefix(value: string): string | null {
  // Accept "data:image/png;base64,XXXX" → "XXXX", and raw base64 unchanged.
  if (!value) return null;
  const marker = "base64,";
  const idx = value.indexOf(marker);
  if (idx >= 0) return value.slice(idx + marker.length);
  return value;
}
