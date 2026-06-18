-- Improve brand-filtered RAG recall at scale (best-effort, Supabase-safe).
--
-- match_knowledge_chunks runs an HNSW ANN search over a GLOBAL index (all
-- brands' chunks) and then filters by brand_id + rag_status. With the pgvector
-- default hnsw.ef_search = 40, the index scan examines a small candidate list;
-- as total chunk volume grows across brands, too few candidates may belong to
-- the queried brand, so the function returns fewer / lower-quality chunks than
-- match_count — degrading recall on every Brand Brain query and agent run.
--
-- We raise ef_search for the search. NOTE: a function-level `SET hnsw.ef_search`
-- (proconfig) is rejected on Supabase with ERROR 42501 — the non-superuser role
-- can't pin that GUC when the pgvector library isn't loaded in the session (it
-- is then a "placeholder" custom variable). So instead we set it at RUNTIME via
-- set_config(..., is_local := true) inside the body, wrapped in a guard: if the
-- role still can't set it, we silently fall back to the default rather than fail
-- the search. The query body is otherwise the 0012 definition, unchanged.
--
-- Stronger fix for pgvector >= 0.8 (iterative index scans). After confirming
--   select extversion from pg_extension where extname = 'vector';
-- is >= 0.8.0, the same set_config trick can add 'hnsw.iterative_scan'.

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
language plpgsql
stable
as $$
begin
  -- Best-effort: enlarge the HNSW candidate list so enough chunks survive the
  -- brand_id/rag_status filter. is_local => scoped to this statement only.
  begin
    perform set_config('hnsw.ef_search', '100', true);
  exception
    when others then
      null; -- role can't set the GUC; proceed with the default ef_search
  end;

  return query
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
end;
$$;
