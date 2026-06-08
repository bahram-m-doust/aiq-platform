import "server-only";

import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import {
  brandBrainAgentKey,
  resolveBrandBrainReadiness,
} from "@/features/agents/brain/schema";
import type {
  BrandBrainAccess,
  BrandBrainAgent,
  BrandBrainConversationMessage,
  BrandBrainDisplaySource,
  BrandBrainWorkspace,
} from "@/features/agents/brain/types";
import { createAgentImageSignedUrls } from "@/features/agents/runs/image-storage";
import { cacheSharedConfig } from "@/lib/cache/shared";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { createAdminClient } from "@/lib/supabase/admin";

type KnowledgeBaseRow = {
  id: string;
  status: string | null;
  provider_vector_store_id: string | null;
};

type KnowledgeFileRow = {
  id: string;
};

type AgentRow = {
  id: string;
  key: string;
  name: string;
  is_active: boolean;
};

function toAccess({
  brandId,
  brandName,
  membershipRole,
  planName,
}: {
  brandId: string;
  brandName: string;
  membershipRole: string;
  planName: string | null;
}): BrandBrainAccess {
  return {
    brandId,
    brandName,
    membershipRole,
    planName,
  };
}

const loadBrandBrainAgent = cacheSharedConfig(
  async (): Promise<BrandBrainAgent | null> => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("agents")
      .select("id, key, name, is_active")
      .eq("key", brandBrainAgentKey)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const agent = data as AgentRow | null;

    if (!agent) {
      return null;
    }

    return {
      id: agent.id,
      key: "BRAND_INTEGRATOR_BRAIN",
      name: agent.name,
    };
  },
  ["brand-brain-agent"],
  {
    revalidate: 300,
    tags: [CACHE_TAGS.activeAgentCatalog],
  },
);

export async function getBrandBrainAgent(): Promise<BrandBrainAgent | null> {
  return loadBrandBrainAgent();
}

async function getKnowledgeBase(brandId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_bases")
    .select("id, status, provider_vector_store_id")
    .eq("brand_id", brandId)
    .eq("provider", "PGVECTOR")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as KnowledgeBaseRow | null;
}

async function getSyncedKnowledgeFileCount(brandId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_files")
    .select("id")
    .eq("brand_id", brandId)
    .eq("rag_status", "RAG_SYNCED");

  if (error) {
    throw error;
  }

  return ((data ?? []) as KnowledgeFileRow[]).length;
}

export async function getBrandBrainWorkspace(
  profileId: string,
): Promise<BrandBrainWorkspace> {
  const accessSummary = await getBrandAccessSummaryForProfile(profileId);
  const agent = await getBrandBrainAgent();

  if (
    accessSummary.status !== "ACTIVE_ACCESS" ||
    !accessSummary.brandId ||
    !accessSummary.brandName ||
    !accessSummary.membershipRole
  ) {
    return {
      access: null,
      agent,
      readiness: resolveBrandBrainReadiness({
        accessSummary,
        hasAgent: Boolean(agent),
        knowledgeBaseId: null,
        knowledgeBaseStatus: null,
        providerVectorStoreId: null,
        syncedFileCount: 0,
      }),
    };
  }

  const [knowledgeBase, syncedFileCount] = await Promise.all([
    getKnowledgeBase(accessSummary.brandId),
    getSyncedKnowledgeFileCount(accessSummary.brandId),
  ]);

  return {
    access: toAccess({
      brandId: accessSummary.brandId,
      brandName: accessSummary.brandName,
      membershipRole: accessSummary.membershipRole,
      planName: accessSummary.planName,
    }),
    agent,
    readiness: resolveBrandBrainReadiness({
      accessSummary,
      hasAgent: Boolean(agent),
      knowledgeBaseId: knowledgeBase?.id ?? null,
      knowledgeBaseStatus: knowledgeBase?.status ?? null,
      providerVectorStoreId: knowledgeBase?.provider_vector_store_id ?? null,
      syncedFileCount,
    }),
  };
}

type AgentRunConversationRow = {
  id: string;
  input: unknown;
  output: unknown;
  retrieved_sources: unknown;
  created_at: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toDisplaySources(value: unknown): BrandBrainDisplaySource[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const sources = value.reduce<BrandBrainDisplaySource[]>((accumulator, item) => {
    if (!isRecord(item)) {
      return accumulator;
    }

    const fileName = readString(item.fileName);
    if (!fileName) {
      return accumulator;
    }

    accumulator.push({
      fileName,
      score: typeof item.score === "number" ? item.score : null,
    });
    return accumulator;
  }, []);

  return sources.length > 0 ? sources : null;
}

// Rehydrate the chat thread from stored runs so the conversation survives a
// reload. Each run yields the user's question followed by the assistant answer;
// retrieval/budget/audit stay untouched because this is read-only.
export async function getBrandBrainConversation({
  brandId,
  agentId,
  userId,
  limit = 20,
}: {
  brandId: string;
  agentId: string;
  userId: string;
  limit?: number;
}): Promise<BrandBrainConversationMessage[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agent_runs")
    .select("id, input, output, retrieved_sources, created_at")
    .eq("brand_id", brandId)
    .eq("agent_id", agentId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const rows = ((data ?? []) as AgentRunConversationRow[]).slice().reverse();
  const messages: BrandBrainConversationMessage[] = [];

  for (const row of rows) {
    const output = isRecord(row.output) ? row.output : null;
    const prompt = isRecord(row.input) ? readString(row.input.prompt) : "";
    const answer = output ? readString(output.answer) : "";
    const imagePaths =
      output && Array.isArray(output.image_paths)
        ? output.image_paths.filter(
            (path): path is string => typeof path === "string",
          )
        : [];

    if (prompt) {
      messages.push({
        id: `${row.id}-q`,
        role: "user",
        content: prompt,
        sources: null,
      });
    }

    if (imagePaths.length > 0) {
      // Sign per run; a failure to mint URLs shouldn't drop the whole thread.
      let images: string[] = [];
      try {
        images = await createAgentImageSignedUrls(imagePaths);
      } catch {
        images = [];
      }

      messages.push({
        id: `${row.id}-a`,
        role: "assistant",
        content: answer || "Generated image.",
        sources: toDisplaySources(row.retrieved_sources),
        images,
        imagePrompt: output ? readString(output.image_prompt) || null : null,
      });
    } else if (answer) {
      messages.push({
        id: `${row.id}-a`,
        role: "assistant",
        content: answer,
        sources: toDisplaySources(row.retrieved_sources),
      });
    }
  }

  return messages;
}
