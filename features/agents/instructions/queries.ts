import "server-only";

import { resolveEffectiveInstruction } from "@/features/agents/instructions/schema";
import type {
  BrandAgentInstruction,
  BrandAgentInstructionSlot,
  BrandInstructionAdminBrand,
} from "@/features/agents/instructions/types";
import { createAdminClient } from "@/lib/supabase/admin";

type SettingsRow = {
  agent_id: string | null;
  instruction: string | null;
  is_enabled: boolean;
  updated_at: string | null;
};

type BrandRow = {
  id: string;
  name: string;
  status: string | null;
};

function toInstruction(row: SettingsRow): BrandAgentInstruction {
  return {
    agentId: row.agent_id,
    instruction: row.instruction ?? "",
    isEnabled: row.is_enabled,
    updatedAt: row.updated_at,
  };
}

async function getBrandPromptRow(
  brandId: string,
): Promise<SettingsRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brand_agent_settings")
    .select("agent_id, instruction, is_enabled, updated_at")
    .eq("brand_id", brandId)
    .is("agent_id", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as SettingsRow | null) ?? null;
}

// Effective OpenAI-style prompt text for a brand. The agentId argument is kept
// for call-site compatibility, but per-agent override rows are intentionally
// ignored.
export async function getBrandAgentInstruction({
  brandId,
  agentId,
}: {
  brandId: string;
  agentId: string;
}): Promise<string> {
  const row = await getBrandPromptRow(brandId);
  return resolveEffectiveInstruction(row ? [toInstruction(row)] : [], agentId);
}

// Image generation uses the same one brand prompt, matching the OpenAI Platform
// mental model: one prompt text plus server-owned tools.
export async function getLayeredBrandInstruction({
  brandId,
  agentId,
}: {
  brandId: string;
  agentId: string;
}): Promise<string> {
  return getBrandAgentInstruction({ brandId, agentId });
}

export async function getBrandInstructionAdminBrands(): Promise<
  BrandInstructionAdminBrand[]
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brands")
    .select("id, name, status")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as BrandRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
  }));
}

// The admin panel exposes exactly one editable prompt slot per brand.
export async function listBrandInstructionSlots(
  brandId: string,
): Promise<BrandAgentInstructionSlot[]> {
  const row = await getBrandPromptRow(brandId);

  return [
    {
      agentId: null,
      agentKey: null,
      agentName: "Brand Prompt",
      instruction: row?.instruction ?? "",
      isEnabled: row?.is_enabled ?? true,
      updatedAt: row?.updated_at ?? null,
    },
  ];
}
