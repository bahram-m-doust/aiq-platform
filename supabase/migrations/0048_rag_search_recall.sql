-- Improve brand-filtered RAG recall at scale.
--
-- match_knowledge_chunks runs an HNSW ANN search over a GLOBAL index (all
-- brands' chunks) and then filters by brand_id + rag_status. With the pgvector
-- default hnsw.ef_search = 40, the index scan examines a small candidate list;
-- as total chunk volume grows across brands, too few of those candidates may
-- belong to the queried brand, so the function returns fewer / lower-quality
-- chunks than match_count — degrading recall on every Brand Brain query and
-- agent run. Raising ef_search for this function enlarges the candidate list so
-- enough survive the brand filter.
--
-- Safe + version-agnostic: hnsw.ef_search exists for every HNSW-capable pgvector
-- and is a namespaced GUC (accepted as a placeholder even before the extension
-- library loads), and the query logic below is byte-for-byte the 0012 definition
-- — only the SET clause is added. It trades a little latency for recall.
--
-- Stronger fix for pgvector >= 0.8 (iterative index scans, which keep scanning
-- until match_count rows pass the filter). After confirming the version with
--   select extversion from pg_extension where extname = 'vector';
-- you can additionally run:
--   alter function match_knowledge_chunks(vector, uuid, integer, uuid[])
--     set hnsw.iterative_scan = 'relaxed_order';

create or replace function match_knowledge_chunks(
  query_embedding vector(1536),
  match_brand_id uuid,
  match_count int default 5,
  match_module_ids uuid[] default null
)
returns table (
  id uuid,
  knowledge_file_id uuid,
  module_id uuid,
  chunk_text text,
  score float,
  file_name text
)
language sql stable
set hnsw.ef_search = '100'
as $$
  select
    kc.id,
    kc.knowledge_file_id,
    kc.module_id,
    kc.chunk_text,
    1 - (kc.embedding <=> query_embedding) as score,
    f.original_name as file_name
  from knowledge_chunks kc
  join knowledge_files kf on kf.id = kc.knowledge_file_id
  join files f on f.id = kf.file_id
  where kc.brand_id = match_brand_id
    and kf.rag_status = 'RAG_SYNCED'
    and (match_module_ids is null or kc.module_id = any(match_module_ids))
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;
