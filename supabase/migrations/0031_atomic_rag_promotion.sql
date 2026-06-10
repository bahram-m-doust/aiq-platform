create or replace function public.promote_document_to_rag(
  p_file_id uuid,
  p_actor_id uuid
)
returns table (
  id uuid,
  brand_id uuid,
  storage_path text,
  original_name text,
  mime_type text,
  size_bytes bigint,
  visibility text,
  status text,
  uploaded_by uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_file public.files%rowtype;
begin
  select *
    into v_file
    from public.files
   where public.files.id = p_file_id
   for update;

  if not found then
    raise exception 'Document could not be found.';
  end if;
  if v_file.brand_id is null then
    raise exception 'Document is not attached to a brand.';
  end if;
  if v_file.status = 'ARCHIVED' then
    raise exception 'Cannot promote an archived document to RAG.';
  end if;

  update public.files
     set status = 'RAG_APPROVED'
   where public.files.id = p_file_id
  returning * into v_file;

  insert into public.knowledge_files (
    brand_id,
    module_id,
    file_id,
    rag_status,
    approved_by_supervisor,
    approved_by_platform_owner
  )
  values (
    v_file.brand_id,
    null,
    v_file.id,
    'RAG_APPROVED',
    p_actor_id,
    p_actor_id
  )
  on conflict (brand_id, file_id) do update
     set rag_status = excluded.rag_status,
         approved_by_supervisor = excluded.approved_by_supervisor,
         approved_by_platform_owner = excluded.approved_by_platform_owner;

  return query
    select
      v_file.id,
      v_file.brand_id,
      v_file.storage_path,
      v_file.original_name,
      v_file.mime_type,
      v_file.size_bytes,
      v_file.visibility,
      v_file.status,
      v_file.uploaded_by,
      v_file.created_at;
end;
$$;

revoke all on function public.promote_document_to_rag(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.promote_document_to_rag(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
