import type { BrandAgentInstruction } from "@/features/agents/instructions/types";

// ~4k tokens: enough room for a full brand instruction document (role, routing,
// tone, prompt rules) without diluting context or inflating per-message cost.
export const brandInstructionMaxLength = 16000;

// Sentinel form value for the brand-wide default slot (agent_id NULL), since an
// HTML form cannot submit a real null.
export const brandWideAgentValue = "__brand_wide__";

// Voice/persona only — never role or safety, which live in code layers and must
// not be re-stated (or weakened) here. Offered as a starting point in the admin
// UI; admins can edit or clear it.
export const brandInstructionStarterTemplate = `Brand voice & persona:
- Tone:
- Personality traits:
- Audience:

Always:
-

Never:
-

Preferred vocabulary / phrases:
-

Topics to avoid:
- `;

export function validateInstruction(value: string): {
  instruction: string;
  error: string | null;
} {
  const instruction = value.trim();

  if (instruction.length > brandInstructionMaxLength) {
    return {
      instruction: "",
      error: `Keep the instruction under ${brandInstructionMaxLength} characters.`,
    };
  }

  // Empty is valid and means "clear this slot" (fall back to role + guard only).
  return { instruction, error: null };
}

// Resolution order for the effective brand instruction of a given agent:
//   per-agent (enabled) > brand-wide default (enabled) > "".
export function resolveEffectiveInstruction(
  rows: BrandAgentInstruction[],
  agentId: string,
): string {
  const perAgent = rows.find(
    (row) => row.agentId === agentId && row.isEnabled,
  );
  if (perAgent && perAgent.instruction) {
    return perAgent.instruction;
  }

  const brandWide = rows.find((row) => row.agentId === null && row.isEnabled);
  if (brandWide && brandWide.instruction) {
    return brandWide.instruction;
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
