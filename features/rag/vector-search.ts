import "server-only";

import { embedQuery } from "@/features/rag/embeddings";
import { createAdminClient } from "@/lib/supabase/admin";

export type VectorSearchResult = {
  chunkId: string;
  knowledgeFileId: string;
  moduleId: string | null;
  chunkText: string;
  score: number;
  fileName: string;
};

type MatchRow = {
  id: string;
  knowledge_file_id: string;
  module_id: string | null;
  chunk_text: string;
  score: number;
  file_name: string;
};

export async function searchBrandKnowledge({
  brandId,
  query,
  topK = 5,
  moduleIds,
}: {
  brandId: string;
  query: string;
  topK?: number;
  moduleIds?: string[];
}): Promise<VectorSearchResult[]> {
  const queryEmbedding = await embedQuery(query, brandId);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("match_knowledge_chunks", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_brand_id: brandId,
    match_count: topK,
    match_module_ids: moduleIds ?? null,
  });

  if (error) throw error;

  return ((data ?? []) as MatchRow[]).map((row) => ({
    chunkId: row.id,
    knowledgeFileId: row.knowledge_file_id,
    moduleId: row.module_id,
    chunkText: row.chunk_text,
    score: row.score,
    fileName: row.file_name,
  }));
}
