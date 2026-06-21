-- Allow a platform owner to demote a document out of RAG.
-- Deleting the knowledge_files row cascades to knowledge_chunks (pgvector),
-- removing the document from the Knowledge Brain. The file row reverts to
-- UPLOADED so it can be re-promoted later.
create or replace function public.demote_document_from_rag(
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
  created_at timestamptz,
  approved_at timestamptz
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

  -- Remove the document from RAG (chunks cascade-delete with knowledge_files).
  delete from public.knowledge_files
   where public.knowledge_files.file_id = p_file_id;

  update public.files
     set status = 'UPLOADED'
   where public.files.id = p_file_id
  returning * into v_file;

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
      v_file.created_at,
      v_file.approved_at;
end;
$$;

revoke all on function public.demote_document_from_rag(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.demote_document_from_rag(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
