import "server-only";

import {
  extractAnswerExcerpt,
  extractHistorySources,
  extractPromptExcerpt,
} from "@/features/agents/runs/schema";
import type { AgentRunHistoryItem } from "@/features/agents/runs/types";
import { createAdminClient } from "@/lib/supabase/admin";

type AgentRunRow = {
  id: string;
  brand_id: string;
  agent_id: string;
  user_id: string | null;
  input: unknown;
  output: unknown;
  model: string | null;
  retrieved_sources: unknown;
  created_at: string | null;
};

export async function getAgentRunHistory({
  brandId,
  agentId,
  limit = 8,
}: {
  brandId: string;
  agentId: string;
  limit?: number;
}): Promise<AgentRunHistoryItem[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agent_runs")
    .select(
      "id, brand_id, agent_id, user_id, input, output, model, retrieved_sources, created_at",
    )
    .eq("brand_id", brandId)
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return ((data ?? []) as AgentRunRow[]).map((row) => ({
    id: row.id,
    brandId: row.brand_id,
    agentId: row.agent_id,
    userId: row.user_id,
    promptExcerpt: extractPromptExcerpt(row.input),
    answerExcerpt: extractAnswerExcerpt(row.output),
    model: row.model,
    sources: extractHistorySources(row.retrieved_sources),
    createdAt: row.created_at,
  }));
}

