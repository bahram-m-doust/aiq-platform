alter table public.brand_entitlements
  add column if not exists idempotency_key text;

create unique index if not exists ux_brand_entitlements_idempotency_key
  on public.brand_entitlements (idempotency_key)
  where idempotency_key is not null;

alter table public.demo_requests force row level security;
alter table public.knowledge_chunks force row level security;
alter table public.brand_api_keys force row level security;
alter table public.agent_run_usage force row level security;
alter table public.stakeholder_interview_reports force row level security;
alter table public.stakeholder_interview_annotations force row level security;
alter table public.brand_agent_settings force row level security;
alter table public.futures_research_reports force row level security;
alter table public.futures_research_annotations force row level security;

create or replace function public.replace_knowledge_chunks(
  p_knowledge_file_id uuid,
  p_brand_id uuid,
  p_module_id uuid,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if not exists (
    select 1
      from public.knowledge_files
     where id = p_knowledge_file_id
       and brand_id = p_brand_id
  ) then
    raise exception 'Knowledge file does not belong to the requested brand.';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Knowledge chunk payload must be an array.';
  end if;

  delete from public.knowledge_chunks
   where knowledge_file_id = p_knowledge_file_id;

  insert into public.knowledge_chunks (
    knowledge_file_id,
    brand_id,
    module_id,
    chunk_index,
    chunk_text,
    token_count,
    embedding
  )
  select
    p_knowledge_file_id,
    p_brand_id,
    p_module_id,
    (item->>'chunk_index')::integer,
    item->>'chunk_text',
    (item->>'token_count')::integer,
    (item->'embedding')::text::vector(1536)
  from jsonb_array_elements(p_rows) as item;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.replace_knowledge_chunks(uuid, uuid, uuid, jsonb)
from public, anon, authenticated;

grant execute on function public.replace_knowledge_chunks(uuid, uuid, uuid, jsonb)
to service_role;

notify pgrst, 'reload schema';
