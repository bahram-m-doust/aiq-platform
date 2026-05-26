create extension if not exists vector;

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  knowledge_file_id uuid not null references public.knowledge_files(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  module_id uuid references public.brand_modules(id),
  chunk_index int not null,
  chunk_text text not null,
  token_count int not null default 0,
  embedding vector(1536),
  created_at timestamptz default now()
);

create index if not exists idx_knowledge_chunks_brand
  on public.knowledge_chunks(brand_id);
create index if not exists idx_knowledge_chunks_knowledge_file
  on public.knowledge_chunks(knowledge_file_id);
create index if not exists idx_knowledge_chunks_module
  on public.knowledge_chunks(module_id);
create index if not exists idx_knowledge_chunks_embedding
  on public.knowledge_chunks using hnsw (embedding vector_cosine_ops);

alter table public.knowledge_chunks enable row level security;
alter table public.knowledge_chunks force row level security;

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
