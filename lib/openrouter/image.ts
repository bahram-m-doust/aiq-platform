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
        // OpenRouter-native images extension field (primary)
        images?: Array<{ image_url?: { url?: string | null } | null } | null>;
        // Some models return images as content-part items (fallback)
        content?: string | Array<{
          type?: string;
          image_url?: { url?: string | null } | null;
        } | null>;
      };
    }>;
    usage?: unknown;
  };
  const choices = normalized.choices ?? [];

  // ── TEMP DIAGNOSTIC ──────────────────────────────────────────────────────
  // Logs the real shape OpenRouter returns so we can pinpoint why stored PNGs
  // are corrupt. Remove once the preview is confirmed working.
  try {
    const msg = choices[0]?.message as Record<string, unknown> | undefined;
    console.log("[image-diag] model:", model);
    console.log("[image-diag] choices:", choices.length);
    console.log("[image-diag] message keys:", msg ? Object.keys(msg) : null);
    console.log(
      "[image-diag] images field type:",
      Array.isArray(msg?.images) ? `array(${(msg!.images as unknown[]).length})` : typeof msg?.images,
    );
    console.log(
      "[image-diag] content field type:",
      Array.isArray(msg?.content) ? `array(${(msg!.content as unknown[]).length})` : typeof msg?.content,
    );
    console.log(
      "[image-diag] raw message (truncated):",
      JSON.stringify(msg).slice(0, 600),
    );
  } catch {
    /* diagnostic only */
  }
  // ─────────────────────────────────────────────────────────────────────────

  const rawUrls: string[] = [];
  for (const choice of choices) {
    for (const img of (choice?.message?.images ?? [])) {
      const url = img?.image_url?.url;
      if (typeof url === "string") rawUrls.push(url);
    }
    const content = choice?.message?.content;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part?.type === "image_url") {
          const url = part?.image_url?.url;
          if (typeof url === "string") rawUrls.push(url);
        }
      }
    }
  }

  // ── TEMP DIAGNOSTIC ──────────────────────────────────────────────────────
  rawUrls.forEach((u, i) => {
    const kind = u.startsWith("data:")
      ? "data-uri"
      : u.startsWith("http")
        ? "http-url"
        : "raw/unknown";
    console.log(`[image-diag] rawUrl[${i}] kind=${kind} len=${u.length} head="${u.slice(0, 80)}"`);
  });
  // ─────────────────────────────────────────────────────────────────────────

  const b64Images = (await Promise.all(rawUrls.map(resolveToBase64)))
    .filter((b): b is string => Boolean(b));

  // ── TEMP DIAGNOSTIC ──────────────────────────────────────────────────────
  // Decode the first bytes and report the detected image signature so we know
  // whether what we store is actually a valid PNG/JPEG/WEBP.
  b64Images.forEach((b, i) => {
    const buf = Buffer.from(b, "base64");
    const hex = buf.subarray(0, 8).toString("hex");
    let sig = "UNKNOWN";
    if (hex.startsWith("89504e47")) sig = "PNG";
    else if (hex.startsWith("ffd8ff")) sig = "JPEG";
    else if (buf.subarray(0, 4).toString("ascii") === "RIFF") sig = "WEBP";
    else if (hex.startsWith("47494638")) sig = "GIF";
    console.log(
      `[image-diag] b64[${i}] bytes=${buf.length} magic=${hex} → ${sig}`,
    );
  });
  // ─────────────────────────────────────────────────────────────────────────

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

// Resolves any image URL to a raw base64 string for PNG persistence:
//   - data URI  → strip the "data:...;base64," prefix
//   - HTTPS URL → fetch the bytes and base64-encode them
//   - raw base64 → pass through unchanged
async function resolveToBase64(url: string): Promise<string | null> {
  if (!url) return null;
  const marker = "base64,";
  const idx = url.indexOf(marker);
  if (idx >= 0) return url.slice(idx + marker.length);
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      return Buffer.from(buf).toString("base64");
    } catch {
      return null;
    }
  }
  return url;
}
