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

// OpenRouter exposes two image transports depending on the model family:
//
//   /images/generations (OpenAI-compatible) — used by dedicated image models:
//     google/gemini-2.5-flash-image, openai/gpt-image-1.
//     Response: data[].b64_json (when response_format:"b64_json" is set).
//
//   /chat/completions with modalities:["image","text"] — used by multimodal
//     chat models that emit images alongside text:
//     openai/gpt-5.4-image-2.
//     Response: choices[0].message.images[].image_url.url as a data URI.

const CHAT_COMPLETIONS_IMAGE_MODELS = new Set<ImageModelId>([
  "openai/gpt-5.4-image-2",
]);

/**
 * Generate one or more PNG images via OpenRouter.
 * Normalises both transports to raw base64 strings for PNG persistence.
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

  const transport = CHAT_COMPLETIONS_IMAGE_MODELS.has(model)
    ? await generateViaChatCompletions(client, model, prompt, n)
    : await generateViaImagesEndpoint(client, model, prompt, n);

  const b64Images = transport.b64Images;
  const imageCount = b64Images.length;
  const costCents = providerCostCents(
    transport.usage,
    computeImageCostCents({ model, imageCount }),
  );

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
): Promise<{ b64Images: string[]; usage: unknown }> {
  // The OpenAI SDK types images.generate for OpenAI model IDs only; OpenRouter
  // accepts arbitrary model ids so we cast through unknown to satisfy TS.
  const response = await client.images.generate({
    model,
    prompt,
    n,
    response_format: "b64_json",
  } as unknown as Parameters<typeof client.images.generate>[0]);

  const normalized = response as unknown as {
    data?: Array<{ b64_json?: string | null }>;
    usage?: unknown;
  };
  const data = normalized.data ?? [];

  return {
    b64Images: data
      .map((d) => d?.b64_json ?? null)
      .filter((b): b is string => Boolean(b)),
    usage: normalized.usage,
  };
}

async function generateViaChatCompletions(
  client: Awaited<ReturnType<typeof getOpenRouterClientForBrand>>,
  model: ImageModelId,
  prompt: string,
  n: number,
): Promise<{ b64Images: string[]; usage: unknown }> {
  // OpenRouter forwards the `modalities` field to the upstream provider verbatim;
  // the OpenAI SDK types don't know about it so we cast the payload.
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

  return {
    b64Images: dataUrls
      .map(stripDataUrlPrefix)
      .filter((b): b is string => Boolean(b)),
    usage: normalized.usage,
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
