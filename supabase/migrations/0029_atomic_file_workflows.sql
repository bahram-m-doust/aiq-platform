create or replace function public.attach_review_deliverable(
  p_workflow text,
  p_brand_id uuid,
  p_profile_id uuid,
  p_file_id uuid,
  p_storage_path text,
  p_original_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_storyline boolean default false
)
returns table (report_id uuid, old_file_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_report_id uuid;
  v_old_file_id uuid;
  v_now timestamptz := now();
begin
  if p_workflow = 'STAKEHOLDER_INTERVIEWS' then
    if p_storyline then
      raise exception 'Stakeholder interviews do not support storyline files.';
    end if;

    insert into public.stakeholder_interview_reports (brand_id, status)
    values (p_brand_id, 'PENDING_UPLOAD')
    on conflict (brand_id) do nothing;

    select id, file_id
      into v_report_id, v_old_file_id
      from public.stakeholder_interview_reports
     where brand_id = p_brand_id
     for update;
  elsif p_workflow = 'FUTURES_RESEARCH' then
    insert into public.futures_research_reports (brand_id, status)
    values (p_brand_id, 'PENDING_UPLOAD')
    on conflict (brand_id) do nothing;

    if p_storyline then
      select id, storyline_file_id
        into v_report_id, v_old_file_id
        from public.futures_research_reports
       where brand_id = p_brand_id
       for update;
    else
      select id, file_id
        into v_report_id, v_old_file_id
        from public.futures_research_reports
       where brand_id = p_brand_id
       for update;
    end if;
  else
    raise exception 'Unsupported review workflow.';
  end if;

  insert into public.files (
    id,
    brand_id,
    storage_path,
    original_name,
    mime_type,
    size_bytes,
    visibility,
    status,
    uploaded_by
  )
  values (
    p_file_id,
    p_brand_id,
    p_storage_path,
    p_original_name,
    p_mime_type,
    p_size_bytes,
    'CLIENT_REVIEW',
    'CLIENT_REVIEW',
    p_profile_id
  );

  if p_workflow = 'STAKEHOLDER_INTERVIEWS' then
    update public.stakeholder_interview_reports
       set file_id = p_file_id,
           status = 'CLIENT_REVIEW',
           uploaded_by = p_profile_id,
           uploaded_at = v_now,
           approved_by = null,
           approved_at = null,
           updated_at = v_now
     where id = v_report_id;
  elsif p_storyline then
    update public.futures_research_reports
       set storyline_file_id = p_file_id,
           updated_at = v_now
     where id = v_report_id;
  else
    update public.futures_research_reports
       set file_id = p_file_id,
           status = 'CLIENT_REVIEW',
           uploaded_by = p_profile_id,
           uploaded_at = v_now,
           approved_by = null,
           approved_at = null,
           updated_at = v_now
     where id = v_report_id;
  end if;

  return query select v_report_id, v_old_file_id;
end;
$$;

create or replace function public.create_module_artifact_with_file(
  p_module_id uuid,
  p_brand_id uuid,
  p_uploaded_by uuid,
  p_file_id uuid,
  p_storage_path text,
  p_original_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_artifact_type text,
  p_next_version integer
)
returns table (
  id uuid,
  module_id uuid,
  artifact_type text,
  file_id uuid,
  version integer,
  status text,
  uploaded_by uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_module public.brand_modules%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_module_id::text, 0));

  select *
    into v_module
    from public.brand_modules
   where public.brand_modules.id = p_module_id
     and brand_id = p_brand_id
   for update;

  if not found then
    raise exception 'Module not found.';
  end if;
  if p_artifact_type not in ('PDF', 'DOCX') or p_next_version < 1 then
    raise exception 'Invalid module artifact metadata.';
  end if;
  if exists (
    select 1 from public.module_artifacts
     where public.module_artifacts.module_id = p_module_id
       and public.module_artifacts.version = p_next_version
  ) then
    raise exception 'Module artifact version already exists.';
  end if;

  insert into public.files (
    id, brand_id, storage_path, original_name, mime_type, size_bytes,
    visibility, status, uploaded_by
  )
  values (
    p_file_id, p_brand_id, p_storage_path, p_original_name, p_mime_type,
    p_size_bytes, 'HELIO_INTERNAL', 'INTERNAL_DRAFT', p_uploaded_by
  );

  return query
    insert into public.module_artifacts (
      module_id, artifact_type, file_id, version, status, uploaded_by
    )
    values (
      p_module_id, p_artifact_type, p_file_id, p_next_version,
      'INTERNAL_DRAFT', p_uploaded_by
    )
    returning
      module_artifacts.id,
      module_artifacts.module_id,
      module_artifacts.artifact_type,
      module_artifacts.file_id,
      module_artifacts.version,
      module_artifacts.status,
      module_artifacts.uploaded_by,
      module_artifacts.created_at;

  update public.brand_modules
     set status = 'INTERNAL_REVIEW',
         current_version = p_next_version,
         updated_at = now()
   where public.brand_modules.id = p_module_id;
end;
$$;

revoke all on function public.attach_review_deliverable(
  text, uuid, uuid, uuid, text, text, text, bigint, boolean
) from public, anon, authenticated;
revoke all on function public.create_module_artifact_with_file(
  uuid, uuid, uuid, uuid, text, text, text, bigint, text, integer
) from public, anon, authenticated;

grant execute on function public.attach_review_deliverable(
  text, uuid, uuid, uuid, text, text, text, bigint, boolean
) to service_role;
grant execute on function public.create_module_artifact_with_file(
  uuid, uuid, uuid, uuid, text, text, text, bigint, text, integer
) to service_role;

notify pgrst, 'reload schema';
