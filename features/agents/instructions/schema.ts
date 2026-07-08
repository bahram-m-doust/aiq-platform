import type { BrandAgentInstruction } from "@/features/agents/instructions/types";

// ~4k tokens: enough room for a full OpenAI-Platform-style brand prompt.
export const brandInstructionMaxLength = 16000;

// Sentinel form value for the single brand prompt slot (agent_id NULL), since an
// HTML form cannot submit a real null.
export const brandWideAgentValue = "__brand_wide__";

// Starting point offered by the "Insert template" button. Admins edit one
// prompt text per brand; vector store routing and safety guards stay in code.
export function buildBrandInstructionTemplate({
  brandName,
}: {
  brandName: string;
  agentName?: string | null;
  agentKey?: string | null;
}): string {
  const brand = brandName.trim() || "this brand";

  return `# ${brand} Brand Digital Twin

## Mission
Act as the digital twin of ${brand}'s brand owner: a brand-side expert, creative director, strategist, visual-system guardian, and multidisciplinary advisor.

## Operational Standard
Treat this prompt as the active operating policy for all responses. Prioritize confirmed brand knowledge, practical execution, and commercially useful judgment.

## Brand Core
- Purpose:
- Audience:
- Values:
- Desired perception:
- Strategic logic:

## Knowledge Use
- Use the brand's approved knowledge files through file search.
- If retrieved knowledge is insufficient, say that the current Brand Brain knowledge base does not contain enough information.
- Do not invent facts or reference other brands.

## Voice And Output Rules
- Tone:
- Do:
- Don't:
- Preferred vocabulary:

## Final Behavior
Before finalizing, check that the response is aligned with confirmed brand knowledge, uses the requested format, and avoids generic branding advice.`;
}

export function validateInstruction(value: string): {
  instruction: string;
  error: string | null;
} {
  const instruction = value.trim();

  if (instruction.length > brandInstructionMaxLength) {
    return {
      instruction: "",
      error: `Keep the prompt under ${brandInstructionMaxLength} characters.`,
    };
  }

  // Empty is valid and means "clear this brand prompt" (fall back to role +
  // safety guard only).
  return { instruction, error: null };
}

// One OpenAI-Platform-style prompt per brand. The agentId argument is kept for
// call-site compatibility, but per-agent overrides are intentionally ignored.
export function resolveEffectiveInstruction(
  rows: BrandAgentInstruction[],
  _agentId: string,
): string {
  void _agentId;

  const brandPrompt = rows.find((row) => row.agentId === null && row.isEnabled);
  if (brandPrompt && brandPrompt.instruction) {
    return brandPrompt.instruction;
  }

  return "";
}

// Generic layered-prompt assembly: drop empty layers and join with blank lines.
export function joinPromptLayers(
  layers: (string | null | undefined)[],
): string {
  return layers
    .map((layer) => (typeof layer === "string" ? layer.trim() : ""))
    .filter((layer) => layer.length > 0)
    .join("\n\n");
}
