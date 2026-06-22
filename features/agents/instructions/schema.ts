import type { BrandAgentInstruction } from "@/features/agents/instructions/types";

// ~4k tokens: enough room for a full brand instruction document (role, routing,
// tone, prompt rules) without diluting context or inflating per-message cost.
export const brandInstructionMaxLength = 16000;

// Sentinel form value for the brand-wide default slot (agent_id NULL), since an
// HTML form cannot submit a real null.
export const brandWideAgentValue = "__brand_wide__";

// Starting point offered by the "Insert template" button. The brand name is
// injected and the skeleton is tailored to the slot: the brand-wide default gets
// the full voice/persona template, while a specific agent gets a focused override
// skeleton (image generation gets a visual-system one, since image prompts need
// rules the conversational voice does not cover). Admins can edit or clear it.
// Never re-state role or safety here — those live in code layers.
export function buildBrandInstructionTemplate({
  brandName,
  agentName,
  agentKey,
}: {
  brandName: string;
  agentName?: string | null;
  agentKey?: string | null;
}): string {
  const brand = brandName.trim() || "this brand";

  // Brand-wide default (agentKey null): full voice/persona starting point. Every
  // agent inherits this unless it has its own override below.
  if (!agentKey) {
    return `You are ${brand}'s dedicated Brand Brain.

Brand voice & persona:
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
  }

  // Image generator: a visual-system override. These rules feed the image prompt
  // rewrite step, so they are concrete and visual rather than conversational.
  if (agentKey === "IMAGE_GENERATOR") {
    return `Visual system for ${brand} image generation (overrides the brand-wide voice for image prompts only):

Color palette (exact hex codes if any):
-

Photography / render style (include any required prefix or suffix):
-

Composition & framing:
-

Subjects to show / avoid:
-

Mood & lighting:
- `;
  }

  // Any other agent: a focused override skeleton. Fill only what must differ from
  // the brand-wide instruction; leave the slot empty to inherit it unchanged.
  const label = agentName?.trim() || "this agent";
  return `Override for ${label} — only what differs from ${brand}'s brand-wide instruction:

Focus / role for this agent:
-

Always:
-

Never:
- `;
}

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
