create or replace function public.transition_rag_approval(
  p_stage text,
  p_artifact_id uuid,
  p_actor_id uuid
)
returns table (
  knowledge_file_id uuid,
  knowledge_brand_id uuid,
  knowledge_module_id uuid,
  knowledge_file_record_id uuid,
  knowledge_rag_status text,
  knowledge_approved_by_supervisor uuid,
  knowledge_approved_by_platform_owner uuid,
  knowledge_created_at timestamptz,
  previous_rag_status text,
  current_module_status text,
  current_artifact_status text,
  current_file_status text,
  changed boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_brand_id uuid;
  v_module_id uuid;
  v_file_id uuid;
  v_module_status text;
  v_artifact_status text;
  v_artifact_type text;
  v_file_status text;
  v_knowledge public.knowledge_files%rowtype;
  v_previous_rag_status text;
  v_changed boolean := false;
  v_target_rag_status text;
begin
  if p_stage not in ('SUPERVISOR', 'PLATFORM_OWNER') then
    raise exception 'Unsupported RAG approval stage.';
  end if;

  select
    bm.brand_id,
    bm.id,
    ma.file_id,
    bm.status,
    ma.status,
    ma.artifact_type,
    f.status
    into
      v_brand_id,
      v_module_id,
      v_file_id,
      v_module_status,
      v_artifact_status,
      v_artifact_type,
      v_file_status
    from public.module_artifacts ma
    join public.brand_modules bm on bm.id = ma.module_id
    join public.files f
      on f.id = ma.file_id
     and f.brand_id = bm.brand_id
   where ma.id = p_artifact_id
   for update of bm, ma, f;

  if not found then
    raise exception 'RAG approval resources could not be found.';
  end if;

  if v_artifact_type <> 'PDF'
     or v_module_status not in (
       'CLIENT_APPROVED',
       'RAG_REVIEW_REQUIRED',
       'RAG_APPROVED'
     )
     or v_artifact_status not in (
       'CLIENT_APPROVED',
       'RAG_REVIEW_REQUIRED',
       'RAG_APPROVED'
     )
     or v_file_status not in ('CLIENT_APPROVED', 'RAG_APPROVED') then
    raise exception 'RAG approval resources are not eligible.';
  end if;

  select *
    into v_knowledge
    from public.knowledge_files
   where brand_id = v_brand_id
     and file_id = v_file_id
   for update;

  if found then
    v_previous_rag_status := v_knowledge.rag_status;

    if v_knowledge.module_id is not null
       and v_knowledge.module_id <> v_module_id then
      raise exception 'Knowledge file belongs to a different module.';
    end if;
  else
    v_previous_rag_status := 'CLIENT_APPROVED';
  end if;

  if p_stage = 'SUPERVISOR' then
    if v_knowledge.id is null then
      insert into public.knowledge_files (
        brand_id,
        module_id,
        file_id,
        rag_status,
        approved_by_supervisor
      )
      values (
        v_brand_id,
        v_module_id,
        v_file_id,
        'RAG_REVIEW_REQUIRED',
        p_actor_id
      )
      returning * into v_knowledge;

      v_changed := true;
    elsif v_knowledge.rag_status in (
      'RAG_APPROVED',
      'SYNCING',
      'RAG_SYNCED',
      'SYNC_FAILED'
    ) then
      if v_knowledge.approved_by_platform_owner is not null then
        if v_knowledge.module_id is distinct from v_module_id then
          update public.knowledge_files
             set module_id = v_module_id
           where id = v_knowledge.id
          returning * into v_knowledge;
          v_changed := true;
        end if;

        if v_module_status <> 'RAG_APPROVED' then
          update public.brand_modules
             set status = 'RAG_APPROVED',
                 updated_at = now()
           where id = v_module_id;
          v_module_status := 'RAG_APPROVED';
          v_changed := true;
        end if;

        if v_artifact_status <> 'RAG_APPROVED' then
          update public.module_artifacts
             set status = 'RAG_APPROVED'
           where id = p_artifact_id;
          v_artifact_status := 'RAG_APPROVED';
          v_changed := true;
        end if;

        if v_file_status <> 'RAG_APPROVED' then
          update public.files
             set status = 'RAG_APPROVED'
           where id = v_file_id;
          v_file_status := 'RAG_APPROVED';
          v_changed := true;
        end if;
      end if;

      return query
        select
          v_knowledge.id,
          v_knowledge.brand_id,
          v_knowledge.module_id,
          v_knowledge.file_id,
          v_knowledge.rag_status,
          v_knowledge.approved_by_supervisor,
          v_knowledge.approved_by_platform_owner,
          v_knowledge.created_at,
          v_previous_rag_status,
          v_module_status,
          v_artifact_status,
          v_file_status,
          v_changed;
      return;
    elsif v_knowledge.module_id is distinct from v_module_id
       or v_knowledge.rag_status is distinct from 'RAG_REVIEW_REQUIRED'
       or v_knowledge.approved_by_supervisor is null then
      update public.knowledge_files
         set module_id = v_module_id,
             rag_status = 'RAG_REVIEW_REQUIRED',
             approved_by_supervisor = coalesce(
               approved_by_supervisor,
               p_actor_id
             )
       where id = v_knowledge.id
      returning * into v_knowledge;

      v_changed := true;
    end if;

    if v_module_status <> 'RAG_APPROVED'
       and v_module_status <> 'RAG_REVIEW_REQUIRED' then
      update public.brand_modules
         set status = 'RAG_REVIEW_REQUIRED',
             updated_at = now()
       where id = v_module_id;
      v_module_status := 'RAG_REVIEW_REQUIRED';
      v_changed := true;
    end if;

    if v_artifact_status <> 'RAG_APPROVED'
       and v_artifact_status <> 'RAG_REVIEW_REQUIRED' then
      update public.module_artifacts
         set status = 'RAG_REVIEW_REQUIRED'
       where id = p_artifact_id;
      v_artifact_status := 'RAG_REVIEW_REQUIRED';
      v_changed := true;
    end if;
  else
    if v_knowledge.id is null
       or v_knowledge.approved_by_supervisor is null then
      raise exception 'Supervisor approval is required before final approval.';
    end if;

    if v_knowledge.rag_status in ('SYNCING', 'RAG_SYNCED', 'SYNC_FAILED') then
      v_target_rag_status := v_knowledge.rag_status;
    else
      v_target_rag_status := 'RAG_APPROVED';
    end if;

    if v_knowledge.module_id is distinct from v_module_id
       or v_knowledge.rag_status is distinct from v_target_rag_status
       or v_knowledge.approved_by_platform_owner is null then
      update public.knowledge_files
         set module_id = v_module_id,
             rag_status = v_target_rag_status,
             approved_by_platform_owner = coalesce(
               approved_by_platform_owner,
               p_actor_id
             )
       where id = v_knowledge.id
      returning * into v_knowledge;

      v_changed := true;
    end if;

    if v_module_status <> 'RAG_APPROVED' then
      update public.brand_modules
         set status = 'RAG_APPROVED',
             updated_at = now()
       where id = v_module_id;
      v_module_status := 'RAG_APPROVED';
      v_changed := true;
    end if;

    if v_artifact_status <> 'RAG_APPROVED' then
      update public.module_artifacts
         set status = 'RAG_APPROVED'
       where id = p_artifact_id;
      v_artifact_status := 'RAG_APPROVED';
      v_changed := true;
    end if;

    if v_file_status <> 'RAG_APPROVED' then
      update public.files
         set status = 'RAG_APPROVED'
       where id = v_file_id;
      v_file_status := 'RAG_APPROVED';
      v_changed := true;
    end if;
  end if;

  return query
    select
      v_knowledge.id,
      v_knowledge.brand_id,
      v_knowledge.module_id,
      v_knowledge.file_id,
      v_knowledge.rag_status,
      v_knowledge.approved_by_supervisor,
      v_knowledge.approved_by_platform_owner,
      v_knowledge.created_at,
      v_previous_rag_status,
      v_module_status,
      v_artifact_status,
      v_file_status,
      v_changed;
end;
$$;

revoke all on function public.transition_rag_approval(text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.transition_rag_approval(text, uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
