import "server-only";

import {
  joinPromptLayers,
  resolveEffectiveInstruction,
} from "@/features/agents/instructions/schema";
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

type AgentRow = {
  id: string;
  key: string;
  name: string;
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

// Effective brand instruction (layer [2]) for one agent's chat turn. Reads the
// per-agent override and the brand-wide default in a single query, then applies
// the resolution order.
export async function getBrandAgentInstruction({
  brandId,
  agentId,
}: {
  brandId: string;
  agentId: string;
}): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brand_agent_settings")
    .select("agent_id, instruction, is_enabled, updated_at")
    .eq("brand_id", brandId)
    .or(`agent_id.eq.${agentId},agent_id.is.null`);

  if (error) {
    throw error;
  }

  const rows = ((data ?? []) as SettingsRow[]).map(toInstruction);
  return resolveEffectiveInstruction(rows, agentId);
}

// Layered instruction for image generation. Unlike chat (which picks ONE
// effective instruction), an image prompt must carry the brand's FULL identity —
// strategy, voice, and visual — so the brand-wide default is always the base,
// with any agent-specific override (e.g. IMAGE_GENERATOR visual rules) layered on
// top rather than replacing it. Either layer may be empty.
export async function getLayeredBrandInstruction({
  brandId,
  agentId,
}: {
  brandId: string;
  agentId: string;
}): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brand_agent_settings")
    .select("agent_id, instruction, is_enabled, updated_at")
    .eq("brand_id", brandId)
    .or(`agent_id.eq.${agentId},agent_id.is.null`);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as SettingsRow[];
  const brandWide = rows.find((r) => r.agent_id === null && r.is_enabled);
  const perAgent = rows.find((r) => r.agent_id === agentId && r.is_enabled);

  // Full brand identity first, then the agent-specific refinement.
  return joinPromptLayers([
    brandWide?.instruction ?? "",
    perAgent?.instruction ?? "",
  ]);
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

// All editable slots for a brand: the brand-wide default first, then one slot
// per active agent, each pre-filled with its stored value (if any).
export async function listBrandInstructionSlots(
  brandId: string,
): Promise<BrandAgentInstructionSlot[]> {
  const admin = createAdminClient();

  const [agentsResult, settingsResult] = await Promise.all([
    admin
      .from("agents")
      .select("id, key, name")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    admin
      .from("brand_agent_settings")
      .select("agent_id, instruction, is_enabled, updated_at")
      .eq("brand_id", brandId),
  ]);

  if (agentsResult.error) {
    throw agentsResult.error;
  }
  if (settingsResult.error) {
    throw settingsResult.error;
  }

  const agents = (agentsResult.data ?? []) as AgentRow[];
  const settings = (settingsResult.data ?? []) as SettingsRow[];
  const byAgentId = new Map<string | null, SettingsRow>(
    settings.map((row) => [row.agent_id, row]),
  );

  const brandWide = byAgentId.get(null);
  const slots: BrandAgentInstructionSlot[] = [
    {
      agentId: null,
      agentKey: null,
      agentName: "Brand-wide default",
      instruction: brandWide?.instruction ?? "",
      isEnabled: brandWide?.is_enabled ?? true,
      updatedAt: brandWide?.updated_at ?? null,
    },
  ];

  for (const agent of agents) {
    const row = byAgentId.get(agent.id);
    slots.push({
      agentId: agent.id,
      agentKey: agent.key,
      agentName: agent.name,
      instruction: row?.instruction ?? "",
      isEnabled: row?.is_enabled ?? true,
      updatedAt: row?.updated_at ?? null,
    });
  }

  return slots;
}
