-- Aesthetics deliverables (Build Roadmap · Phase 3)
-- Three single-file PDF deliverables per brand — Visual Direction, Color & Type
-- System, Asset Library — uploaded by the Bextudio team and reviewed/approved by
-- the client exactly like Futures Research and the City Model districts.
--
-- One generic table keyed by `kind` (vs three near-identical tables). Comments
-- use the unified `review_comments` system, so there is no per-feature
-- annotation table. PDF bytes live in the shared private `files` table.

create table public.aesthetics_deliverables (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  -- VISUAL_DIRECTION | COLOR_TYPE_SYSTEM | ASSET_LIBRARY
  kind text not null
    check (kind in ('VISUAL_DIRECTION', 'COLOR_TYPE_SYSTEM', 'ASSET_LIBRARY')),
  file_id uuid references public.files(id) on delete set null,
  -- PENDING_UPLOAD | CLIENT_REVIEW | CHANGES_REQUESTED | APPROVED
  status text not null default 'PENDING_UPLOAD',
  uploaded_by uuid references public.users_profile(id),
  uploaded_at timestamptz,
  approved_by uuid references public.users_profile(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, kind)
);

create index aesthetics_deliverables_brand_idx
  on public.aesthetics_deliverables (brand_id);

-- Deny-by-default RLS; all access is through the service-role admin client
-- behind app-level authorization (matches the rest of the schema).
alter table public.aesthetics_deliverables enable row level security;
alter table public.aesthetics_deliverables force row level security;
revoke all on public.aesthetics_deliverables from anon, authenticated;

-- Extend the shared attach RPC with a generic branch for the three aesthetics
-- workflows (kind == workflow). The whole body is restated (create or replace)
-- and the update block is restructured so a new workflow can never fall through
-- to the Futures Research branch.
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
  elsif p_workflow in ('VISUAL_DIRECTION', 'COLOR_TYPE_SYSTEM', 'ASSET_LIBRARY') then
    if p_storyline then
      raise exception 'Aesthetics deliverables do not support storyline files.';
    end if;

    insert into public.aesthetics_deliverables (brand_id, kind, status)
    values (p_brand_id, p_workflow, 'PENDING_UPLOAD')
    on conflict (brand_id, kind) do nothing;

    select id, file_id
      into v_report_id, v_old_file_id
      from public.aesthetics_deliverables
     where brand_id = p_brand_id
       and kind = p_workflow
     for update;
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
  elsif p_workflow = 'FUTURES_RESEARCH' then
    if p_storyline then
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
  elsif p_workflow in ('VISUAL_DIRECTION', 'COLOR_TYPE_SYSTEM', 'ASSET_LIBRARY') then
    update public.aesthetics_deliverables
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

revoke all on function public.attach_review_deliverable(
  text, uuid, uuid, uuid, text, text, text, bigint, boolean
) from public, anon, authenticated;

grant execute on function public.attach_review_deliverable(
  text, uuid, uuid, uuid, text, text, text, bigint, boolean
) to service_role;

notify pgrst, 'reload schema';
