export const DEFAULT_OPENAI_TEXT_MODEL = "gpt-4o-mini";

// Prices in cents per 1M tokens. Keep this conservative for budget reservations
// when OpenAI does not return billable cost directly.
const OPENAI_TEXT_PRICES: Record<
  string,
  { promptPerMillion: number; completionPerMillion: number }
> = {
  "gpt-4o-mini": { promptPerMillion: 15, completionPerMillion: 60 },
  "gpt-4o": { promptPerMillion: 250, completionPerMillion: 1000 },
  "gpt-4.1-mini": { promptPerMillion: 40, completionPerMillion: 160 },
  "gpt-4.1": { promptPerMillion: 200, completionPerMillion: 800 },
  "gpt-5.4-mini": { promptPerMillion: 25, completionPerMillion: 200 },
  "gpt-5.4": { promptPerMillion: 125, completionPerMillion: 1000 },
};

export function coerceOpenAITextModel(value: unknown): string {
  const model = typeof value === "string" ? value.trim() : "";
  return model || DEFAULT_OPENAI_TEXT_MODEL;
}

export function computeOpenAITextCostCents({
  model,
  promptTokens,
  completionTokens,
}: {
  model: string;
  promptTokens: number;
  completionTokens: number;
}) {
  const price = OPENAI_TEXT_PRICES[model];
  if (!price) return 0;

  const promptCost = (promptTokens / 1_000_000) * price.promptPerMillion;
  const completionCost =
    (completionTokens / 1_000_000) * price.completionPerMillion;

  return Math.max(0, promptCost + completionCost);
}

