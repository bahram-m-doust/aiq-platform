create table if not exists public.storage_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  source_file_id uuid,
  storage_path text not null unique,
  reason text not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists storage_cleanup_jobs_created_at_idx
  on public.storage_cleanup_jobs (created_at);
create index if not exists storage_cleanup_jobs_source_file_id_idx
  on public.storage_cleanup_jobs (source_file_id);

alter table public.storage_cleanup_jobs enable row level security;
alter table public.storage_cleanup_jobs force row level security;
revoke all on public.storage_cleanup_jobs from anon, authenticated;

create or replace function public.enqueue_storage_cleanup(
  p_storage_path text,
  p_source_file_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id uuid;
begin
  if nullif(btrim(p_storage_path), '') is null then
    raise exception 'Storage path is required.';
  end if;

  insert into public.storage_cleanup_jobs (
    source_file_id, storage_path, reason
  )
  values (
    p_source_file_id, p_storage_path, p_reason
  )
  on conflict (storage_path) do update
     set source_file_id = excluded.source_file_id,
         reason = excluded.reason,
         updated_at = now()
  returning id into v_job_id;

  return v_job_id;
end;
$$;

create or replace function public.mark_storage_cleanup_attempt(p_job_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.storage_cleanup_jobs
     set attempts = attempts + 1,
         updated_at = now()
   where id = p_job_id;
$$;

create or replace function public.delete_file_and_queue_storage_cleanup(
  p_file_id uuid,
  p_reason text
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
  if exists (
    select 1 from public.module_artifacts
     where module_artifacts.file_id = p_file_id
  ) or exists (
    select 1 from public.stakeholder_interview_reports
     where stakeholder_interview_reports.file_id = p_file_id
  ) or exists (
    select 1 from public.futures_research_reports
     where futures_research_reports.file_id = p_file_id
        or futures_research_reports.storyline_file_id = p_file_id
  ) then
    raise exception 'Document is still attached to a workflow.';
  end if;

  perform public.enqueue_storage_cleanup(
    v_file.storage_path, v_file.id, p_reason
  );
  delete from public.knowledge_files where file_id = p_file_id;
  delete from public.files where public.files.id = p_file_id;

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
  v_old_storage_path text;
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
    id, brand_id, storage_path, original_name, mime_type, size_bytes,
    visibility, status, uploaded_by
  )
  values (
    p_file_id, p_brand_id, p_storage_path, p_original_name, p_mime_type,
    p_size_bytes, 'CLIENT_REVIEW', 'CLIENT_REVIEW', p_profile_id
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

  if v_old_file_id is not null and v_old_file_id <> p_file_id then
    select files.storage_path
      into v_old_storage_path
      from public.files
     where files.id = v_old_file_id;

    if v_old_storage_path is not null then
      perform public.enqueue_storage_cleanup(
        v_old_storage_path,
        v_old_file_id,
        'REVIEW_DELIVERABLE_REPLACED'
      );
      delete from public.knowledge_files where file_id = v_old_file_id;
      delete from public.files where files.id = v_old_file_id;
    end if;
  end if;

  return query select v_report_id, v_old_file_id;
end;
$$;

revoke all on function public.enqueue_storage_cleanup(text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.mark_storage_cleanup_attempt(uuid)
  from public, anon, authenticated;
revoke all on function public.delete_file_and_queue_storage_cleanup(uuid, text)
  from public, anon, authenticated;
revoke all on function public.attach_review_deliverable(
  text, uuid, uuid, uuid, text, text, text, bigint, boolean
) from public, anon, authenticated;

grant execute on function public.enqueue_storage_cleanup(text, uuid, text)
  to service_role;
grant execute on function public.mark_storage_cleanup_attempt(uuid)
  to service_role;
grant execute on function public.delete_file_and_queue_storage_cleanup(uuid, text)
  to service_role;
grant execute on function public.attach_review_deliverable(
  text, uuid, uuid, uuid, text, text, text, bigint, boolean
) to service_role;

notify pgrst, 'reload schema';
