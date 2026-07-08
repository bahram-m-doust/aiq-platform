-- OpenAI File Search mapping for Brand Brain.
-- Existing RAG status labels remain for compatibility, but provider storage
-- now points at OpenAI Vector Stores and OpenAI Files.

alter table public.knowledge_bases
  add column if not exists openai_vector_store_id text,
  add column if not exists openai_vector_store_status text,
  add column if not exists openai_vector_store_created_at timestamptz;

alter table public.knowledge_files
  add column if not exists openai_file_id text,
  add column if not exists openai_vector_store_file_id text,
  add column if not exists openai_sync_status text,
  add column if not exists openai_synced_at timestamptz,
  add column if not exists openai_sync_error text;

create unique index if not exists idx_knowledge_bases_openai_vector_store_id_unique
  on public.knowledge_bases(openai_vector_store_id)
  where openai_vector_store_id is not null;

create index if not exists idx_knowledge_bases_openai_status
  on public.knowledge_bases(openai_vector_store_status);

create index if not exists idx_knowledge_files_openai_file_id
  on public.knowledge_files(openai_file_id)
  where openai_file_id is not null;

create index if not exists idx_knowledge_files_openai_sync_status
  on public.knowledge_files(openai_sync_status);

