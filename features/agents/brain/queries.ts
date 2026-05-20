import "server-only";

import { getBrandAccessSummaryForProfile } from "@/features/access/queries";
import {
  brandBrainAgentKey,
  resolveBrandBrainReadiness,
} from "@/features/agents/brain/schema";
import type {
  BrandBrainAccess,
  BrandBrainAgent,
  BrandBrainWorkspace,
} from "@/features/agents/brain/types";
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

export async function getBrandBrainAgent(): Promise<BrandBrainAgent | null> {
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
}

async function getKnowledgeBase(brandId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_bases")
    .select("id, status, provider_vector_store_id")
    .eq("brand_id", brandId)
    .eq("provider", "OPENAI_FILE_SEARCH")
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
    .eq("rag_status", "RAG_SYNCED")
    .not("provider_file_id", "is", null);

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
