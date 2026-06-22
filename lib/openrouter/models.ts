export type TextModelId =
  | "openai/gpt-4o-mini"
  | "openai/gpt-4o"
  | "anthropic/claude-haiku-4.5"
  | "google/gemini-2.5-flash"
  | "deepseek/deepseek-chat-v3";

export type ImageModelId =
  | "google/gemini-2.5-flash-image"
  | "google/gemini-3.1-flash-image"
  | "google/gemini-3-pro-image"
  | "openai/gpt-5.4-image-2"
  | "black-forest-labs/flux-schnell"
  | "black-forest-labs/flux-1.1-pro";

export type ModelOption<TId extends string> = {
  id: TId;
  name: string;
  blurb: string;
  isDefault?: boolean;
};

export const TEXT_MODELS: readonly ModelOption<TextModelId>[] = [
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o mini",
    blurb: "Cheap, fast, strong general-purpose default.",
    isDefault: true,
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    blurb: "Premium reasoning when quality matters more than cost.",
  },
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    blurb: "Anthropic's fast tier — great for tone and brand voice.",
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    blurb: "Google's fast model with long context.",
  },
  {
    id: "deepseek/deepseek-chat-v3",
    name: "DeepSeek V3",
    blurb: "Cheapest strong reasoning model.",
  },
] as const;

// All image models below generate via OpenRouter's /chat/completions endpoint
// with modalities. IDs are the OpenRouter slugs — keep them in sync with
// https://openrouter.ai/collections/image-models so the selector never offers
// an invalid id (an unknown id returns a 400 from OpenRouter).
export const IMAGE_MODELS: readonly ModelOption<ImageModelId>[] = [
  {
    id: "google/gemini-2.5-flash-image",
    name: "Nano Banana (Gemini 2.5 Flash Image)",
    blurb: "Google's fast image model — cost-effective, versatile default.",
    isDefault: true,
  },
  {
    id: "google/gemini-3.1-flash-image",
    name: "Nano Banana 2 (Gemini 3.1 Flash Image)",
    blurb: "Latest Flash image model — Pro-level quality at Flash speed.",
  },
  {
    id: "google/gemini-3-pro-image",
    name: "Nano Banana Pro (Gemini 3 Pro Image)",
    blurb: "Google's most advanced image generation and editing model.",
  },
  {
    id: "openai/gpt-5.4-image-2",
    name: "GPT Image 2",
    blurb:
      "OpenAI's latest — GPT-5.4 reasoning + GPT Image 2 rendering. Strongest text rendering and edits.",
  },
  {
    id: "black-forest-labs/flux-schnell",
    name: "FLUX Schnell",
    blurb: "Ultra-fast, ultra-cheap. Great for quick iterations.",
  },
  {
    id: "black-forest-labs/flux-1.1-pro",
    name: "FLUX 1.1 Pro",
    blurb: "Black Forest Labs' flagship — high detail, photorealistic quality.",
  },
] as const;

export const DEFAULT_TEXT_MODEL: TextModelId = "openai/gpt-4o-mini";
export const DEFAULT_IMAGE_MODEL: ImageModelId = "google/gemini-2.5-flash-image";

// Prices in cents per 1M tokens (text) or cents per image (image).
// These approximate published OpenRouter prices as of 2026-01.
// Used to compute cost when the provider does not return a usage.cost field.
type TextPrice = { promptPerMillion: number; completionPerMillion: number };
type ImagePrice = { perImage: number };

const TEXT_PRICES: Record<TextModelId, TextPrice> = {
  "openai/gpt-4o-mini":         { promptPerMillion: 15,  completionPerMillion: 60 },
  "openai/gpt-4o":              { promptPerMillion: 250, completionPerMillion: 1000 },
  "anthropic/claude-haiku-4.5": { promptPerMillion: 100, completionPerMillion: 500 },
  "google/gemini-2.5-flash":    { promptPerMillion: 30,  completionPerMillion: 250 },
  "deepseek/deepseek-chat-v3":  { promptPerMillion: 27,  completionPerMillion: 110 },
};

const IMAGE_PRICES: Record<ImageModelId, ImagePrice> = {
  "google/gemini-2.5-flash-image":    { perImage: 3 },   // ~$0.03
  "google/gemini-3.1-flash-image":    { perImage: 5 },   // ~$0.05 estimate
  "google/gemini-3-pro-image":        { perImage: 12 },  // ~$0.12 estimate
  // gpt-5.4-image-2 is token-priced on OpenRouter ($8/M in, $15/M out) rather
  // than per-image, so this is a coarse per-image estimate for the usage
  // ledger. Refine once a real run logs actual token counts.
  "openai/gpt-5.4-image-2":          { perImage: 20 },  // ~$0.20 estimate
  "black-forest-labs/flux-schnell":   { perImage: 1 },   // ~$0.003–$0.01
  "black-forest-labs/flux-1.1-pro":  { perImage: 4 },   // ~$0.04 estimate
};

export function computeTextCostCents({
  model,
  promptTokens,
  completionTokens,
}: {
  model: string;
  promptTokens: number;
  completionTokens: number;
}): number {
  const price = isTextModelId(model) ? TEXT_PRICES[model] : null;
  if (!price) return 0;
  const promptCost = (promptTokens / 1_000_000) * price.promptPerMillion;
  const completionCost = (completionTokens / 1_000_000) * price.completionPerMillion;
  return Math.max(0, promptCost + completionCost);
}

export function computeImageCostCents({
  model,
  imageCount,
}: {
  model: string;
  imageCount: number;
}): number {
  const price = isImageModelId(model) ? IMAGE_PRICES[model] : null;
  if (!price) return 0;
  return Math.max(0, imageCount * price.perImage);
}

export function providerCostCents(
  usage: unknown,
  fallbackCostCents: number,
): number {
  if (typeof usage !== "object" || usage === null) {
    return fallbackCostCents;
  }
  const cost = (usage as { cost?: unknown }).cost;
  return typeof cost === "number" && Number.isFinite(cost) && cost >= 0
    ? cost * 100
    : fallbackCostCents;
}

const TEXT_MODEL_IDS = new Set(TEXT_MODELS.map((m) => m.id));
const IMAGE_MODEL_IDS = new Set(IMAGE_MODELS.map((m) => m.id));

export function isTextModelId(value: unknown): value is TextModelId {
  return typeof value === "string" && TEXT_MODEL_IDS.has(value as TextModelId);
}

export function isImageModelId(value: unknown): value is ImageModelId {
  return (
    typeof value === "string" && IMAGE_MODEL_IDS.has(value as ImageModelId)
  );
}

export function coerceTextModel(value: unknown): TextModelId {
  return isTextModelId(value) ? value : DEFAULT_TEXT_MODEL;
}

export function coerceImageModel(value: unknown): ImageModelId {
  return isImageModelId(value) ? value : DEFAULT_IMAGE_MODEL;
}
