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

// OpenRouter generates images exclusively through /chat/completions with
// `modalities: ["image", "text"]` — it does NOT expose the OpenAI-style
// /images/generations endpoint (that path 404s on OpenRouter). Every image
// model (Seedream, Gemini Flash Image, GPT Image, GPT-5.x Image) therefore
// goes through the chat-completions transport.

/**
 * Generate one or more PNG images via OpenRouter.
 *
 * Transport: /chat/completions with modalities: ["image", "text"]. The image
 * arrives on `choices[0].message.images[]`, each entry shaped as
 * `{ image_url: { url: "data:image/png;base64,..." } }`. We normalize the data
 * URLs to raw base64 strings so callers can persist them as PNG.
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

  const transport = await generateViaChatCompletions(client, model, prompt, n);

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

async function generateViaChatCompletions(
  client: Awaited<ReturnType<typeof getOpenRouterClientForBrand>>,
  model: ImageModelId,
  prompt: string,
  n: number,
): Promise<{ b64Images: string[]; usage: unknown }> {
  // OpenRouter's chat.completions accepts a `modalities` field that the OpenAI
  // SDK types do not know about. Cast the payload to bypass the type check;
  // OpenRouter forwards the param to the upstream provider verbatim.
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
