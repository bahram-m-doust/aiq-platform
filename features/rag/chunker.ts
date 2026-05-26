export type TextChunk = {
  index: number;
  text: string;
  tokenCount: number;
};

const DEFAULT_MAX_TOKENS = 512;
const DEFAULT_OVERLAP = 50;
const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function splitByFirst(text: string, separators: string[]): string[] {
  for (const sep of separators) {
    const parts = text.split(sep).filter(Boolean);
    if (parts.length > 1) {
      return parts.map((part, i) =>
        i < parts.length - 1 ? part + sep : part,
      );
    }
  }
  const maxChars = DEFAULT_MAX_TOKENS * CHARS_PER_TOKEN;
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    parts.push(text.slice(i, i + maxChars));
  }
  return parts;
}

function recursiveSplit(
  text: string,
  maxChars: number,
  separators: string[],
): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const parts = splitByFirst(text, separators);
  const result: string[] = [];

  for (const part of parts) {
    if (part.length <= maxChars) {
      result.push(part);
    } else {
      const remaining = separators.slice(1);
      result.push(...recursiveSplit(part, maxChars, remaining.length > 0 ? remaining : [""]));
    }
  }

  return result;
}

export function chunkText(
  text: string,
  options?: { maxTokens?: number; overlap?: number },
): TextChunk[] {
  const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
  const overlap = options?.overlap ?? DEFAULT_OVERLAP;
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const overlapChars = overlap * CHARS_PER_TOKEN;

  const trimmed = text.trim();
  if (!trimmed) return [];

  const separators = ["\n\n", "\n", ". ", " "];
  const rawParts = recursiveSplit(trimmed, maxChars, separators);

  const merged: string[] = [];
  let current = "";

  for (const part of rawParts) {
    if (current && (current + part).length > maxChars) {
      merged.push(current.trim());
      const overlapText = current.slice(-overlapChars);
      current = overlapText + part;
    } else {
      current += part;
    }
  }

  if (current.trim()) {
    merged.push(current.trim());
  }

  return merged.map((chunk, i) => ({
    index: i,
    text: chunk,
    tokenCount: estimateTokens(chunk),
  }));
}
