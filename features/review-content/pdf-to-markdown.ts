import "server-only";

import {
  getOpenRouterClientForBrand,
  getOpenRouterModel,
  hasOpenRouterEnv,
} from "@/lib/openrouter/client";

// Hard cap on input characters per LLM call so a huge document can't blow the
// context window. ~48k chars ≈ a long report; longer docs are truncated with a
// marker (good enough for headings; full fidelity needs a `.md` source).
const MAX_INPUT_CHARS = 48_000;
// Restructuring roughly preserves length; cap the output and the wall-clock so
// a slow provider can never stall an upload request indefinitely. On timeout
// the caller falls back to the raw extracted text.
const MAX_OUTPUT_TOKENS = 16_000;
const REQUEST_TIMEOUT_MS = 60_000;

const SYSTEM_PROMPT = [
  "You convert raw text extracted from a document into clean Markdown.",
  "Rules:",
  "- Infer a sensible heading hierarchy using #, ##, ### based on the text's structure.",
  "- Preserve the original language exactly, including Persian/RTL text and digits. Do NOT translate.",
  "- Keep lists, tables, and emphasis where clearly present.",
  "- Do NOT invent, summarize, or add content. Only restructure what is given.",
  "- Remove obvious extraction noise (stray page numbers, repeated headers/footers).",
  "- Output ONLY the Markdown. No commentary, no code fences around the whole document.",
].join("\n");

export function hasMarkdownGenerationEnv(): boolean {
  return hasOpenRouterEnv();
}

// Restructures extracted document text into clean Markdown with headings via the
// brand's OpenRouter model. Returns trimmed markdown, or throws on LLM failure.
export async function structureTextAsMarkdown({
  rawText,
  brandId,
}: {
  rawText: string;
  brandId: string;
}): Promise<string> {
  const trimmed = rawText.trim();
  if (!trimmed) return "";

  const input =
    trimmed.length > MAX_INPUT_CHARS
      ? `${trimmed.slice(0, MAX_INPUT_CHARS)}\n\n[...truncated...]`
      : trimmed;

  const client = await getOpenRouterClientForBrand(brandId);
  const response = await client.chat.completions.create(
    {
      model: getOpenRouterModel(),
      temperature: 0,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: input },
      ],
    },
    { timeout: REQUEST_TIMEOUT_MS },
  );

  const content = response.choices[0]?.message?.content ?? "";
  return content.trim();
}
