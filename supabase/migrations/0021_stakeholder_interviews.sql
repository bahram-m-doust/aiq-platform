-- Stakeholder Interviews (Brand Research · step 2)
-- The Bextudio team uploads a PDF analysis of interviews with the client's
-- brand team. The client views it, leaves PDF-anchored annotations, and then
-- approves it — which unlocks Futures Research (step 3).
--
-- One report per brand. PDF bytes live in the shared private `files` table
-- (bucket: bextudio-files), same as module artifacts.

create table public.stakeholder_interview_reports (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  file_id uuid references public.files(id) on delete set null,
  -- PENDING_UPLOAD | CLIENT_REVIEW | CHANGES_REQUESTED | APPROVED
  status text not null default 'PENDING_UPLOAD',
  uploaded_by uuid references public.users_profile(id),
  uploaded_at timestamptz,
  approved_by uuid references public.users_profile(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index stakeholder_interview_reports_brand_id_key
  on public.stakeholder_interview_reports (brand_id);

-- PDF-anchored comments. Position is normalized (0..1) within a page so it
-- maps back onto the rendered page at any zoom/size.
create table public.stakeholder_interview_annotations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null
    references public.stakeholder_interview_reports(id) on delete cascade,
  author_id uuid references public.users_profile(id),
  page integer not null,
  pos_x numeric not null,
  pos_y numeric not null,
  body text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stakeholder_interview_annotations_report_idx
  on public.stakeholder_interview_annotations (report_id);

-- Deny-by-default RLS; all access is through the service-role admin client
-- behind app-level authorization (matches the rest of the schema).
alter table public.stakeholder_interview_reports enable row level security;
alter table public.stakeholder_interview_annotations enable row level security;
