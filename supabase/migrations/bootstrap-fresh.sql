-- =============================================================================
-- BOOTSTRAP: full Bextudio platform schema from scratch.
-- =============================================================================
-- !! DESTRUCTIVE !!  Drops the public schema and three storage buckets
-- (bextudio-files, brand-icons, agent-images) along with every row and file
-- they contain. Supabase Auth users (auth.users) are NOT touched, but every
-- users_profile row IS — so users will need to re-onboard on next sign-in.
--
-- BEFORE RUNNING
--   1. Supabase Dashboard → Database → Backups → download a snapshot.
--   2. Make sure SUPABASE_URL in .env.local points at the project you mean
--      to wipe.
--
-- HOW TO RUN
--   Supabase Dashboard → SQL Editor → New query → paste the ENTIRE file →
--   click "Run". You should see "Success. No rows returned." and the trailing
--   NOTIFY at the very end.
--
-- After it succeeds: restart `npm run dev` and refresh. The 42703 / PGRST205
-- errors are gone for good.
-- =============================================================================

-- 1) Wipe storage objects and buckets we own ----------------------------------

delete from storage.objects
where bucket_id in ('bextudio-files', 'brand-icons', 'agent-images');

delete from storage.buckets
where id in ('bextudio-files', 'brand-icons', 'agent-images');

drop policy if exists brand_icons_public_read on storage.objects;

-- 2) Nuke and recreate the public schema --------------------------------------

drop schema if exists public cascade;
create schema public;

grant usage on schema public to anon, authenticated, service_role, postgres;
grant create on schema public to postgres, service_role;

-- 3) Re-create extensions used by the schema ----------------------------------

create extension if not exists pgcrypto;
create extension if not exists vector;

-- =============================================================================
-- Migration 0001: initial schema
-- =============================================================================

create table public.users_profile (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  email text not null,
  full_name text,
  global_role text default 'REGISTERED_USER',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  website text,
  status text not null default 'CREATED',
  created_by uuid references public.users_profile(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric,
  currency text default 'USD',
  duration_days int,
  included_modules jsonb default '[]'::jsonb,
  included_agents jsonb default '[]'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  required_modules jsonb default '[]'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table public.question_sections (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text not null,
  description text,
  order_index int not null,
  is_required boolean default true,
  created_at timestamptz default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.question_sections(id) on delete cascade,
  key text not null unique,
  question_text text not null,
  help_text text,
  input_type text not null,
  is_required boolean default true,
  order_index int not null,
  validation_schema jsonb,
  created_at timestamptz default now()
);

create table public.brand_memberships (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references public.users_profile(id) on delete cascade,
  role text not null,
  status text not null default 'ACTIVE',
  invited_by uuid references public.users_profile(id),
  expires_at timestamptz,
  created_at timestamptz default now(),
  unique (brand_id, user_id, role)
);

create table public.access_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  key_prefix text not null,
  type text not null,
  status text not null default 'ACTIVE',
  target_email text,
  target_brand_id uuid references public.brands(id),
  target_role text,
  plan_id uuid,
  max_redemptions int default 1,
  redeemed_count int default 0,
  expires_at timestamptz not null,
  redeemed_by uuid references public.users_profile(id),
  redeemed_at timestamptz,
  created_by uuid references public.users_profile(id),
  created_at timestamptz default now()
);

create table public.brand_entitlements (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  source text not null,
  status text not null default 'ACTIVE',
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  granted_by uuid references public.users_profile(id),
  manual_reference text,
  internal_note text,
  created_at timestamptz default now()
);

create table public.intake_sessions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  status text not null default 'DRAFT',
  completion_percent int default 0,
  locked_at timestamptz,
  locked_by uuid references public.users_profile(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.intake_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.intake_sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  value jsonb,
  updated_by uuid references public.users_profile(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (session_id, question_id)
);

create table public.intake_snapshots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.intake_sessions(id),
  brand_id uuid not null references public.brands(id),
  snapshot_json jsonb not null,
  generated_docx_file_id uuid,
  created_at timestamptz default now()
);

create table public.brand_modules (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  module_type text not null,
  title text not null,
  status text not null default 'NOT_STARTED',
  assigned_to uuid references public.users_profile(id),
  supervisor_id uuid references public.users_profile(id),
  current_version int default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  mime_type text,
  size_bytes bigint,
  visibility text not null default 'HELIO_INTERNAL',
  status text not null default 'UPLOADED',
  uploaded_by uuid references public.users_profile(id),
  created_at timestamptz default now()
);

create table public.module_artifacts (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.brand_modules(id) on delete cascade,
  artifact_type text not null,
  file_id uuid,
  version int default 1,
  status text default 'UPLOADED',
  uploaded_by uuid references public.users_profile(id),
  created_at timestamptz default now()
);

create table public.module_reviews (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.brand_modules(id) on delete cascade,
  reviewer_id uuid not null references public.users_profile(id),
  review_type text not null,
  decision text not null,
  comment text,
  created_at timestamptz default now()
);

create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  target_type text not null,
  target_id uuid,
  section_key text,
  question_id uuid references public.questions(id),
  requested_by uuid references public.users_profile(id),
  comment text not null,
  status text not null default 'REQUESTED',
  reviewed_by uuid references public.users_profile(id),
  resolution_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  provider text not null default 'OPENAI_FILE_SEARCH',
  provider_vector_store_id text,
  status text default 'NOT_READY',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (brand_id, provider)
);

create table public.knowledge_files (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  module_id uuid references public.brand_modules(id),
  file_id uuid references public.files(id),
  provider_file_id text,
  rag_status text not null default 'NOT_ELIGIBLE',
  approved_by_supervisor uuid references public.users_profile(id),
  approved_by_platform_owner uuid references public.users_profile(id),
  synced_at timestamptz,
  created_at timestamptz default now()
);

create table public.agent_entitlements (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  agent_id uuid not null references public.agents(id),
  plan_id uuid references public.plans(id),
  status text not null default 'LOCKED_BY_PLAN',
  starts_at timestamptz,
  expires_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz default now(),
  unique (brand_id, agent_id)
);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  agent_id uuid references public.agents(id),
  user_id uuid references public.users_profile(id),
  input jsonb,
  output jsonb,
  provider text,
  model text,
  retrieved_sources jsonb,
  cost numeric,
  latency_ms int,
  created_at timestamptz default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users_profile(id),
  actor_role text,
  brand_id uuid references public.brands(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  before_json jsonb,
  after_json jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

create index idx_users_profile_auth_user_id on public.users_profile(auth_user_id);
create index idx_users_profile_email on public.users_profile(email);
create index idx_users_profile_global_role on public.users_profile(global_role);
create index idx_brands_status on public.brands(status);
create index idx_brands_created_by on public.brands(created_by);
create index idx_brand_memberships_brand on public.brand_memberships(brand_id);
create index idx_brand_memberships_user on public.brand_memberships(user_id);
create index idx_brand_memberships_status on public.brand_memberships(status);
create index idx_brand_memberships_invited_by on public.brand_memberships(invited_by);
create index idx_access_keys_status on public.access_keys(status);
create index idx_access_keys_type on public.access_keys(type);
create index idx_access_keys_target_email on public.access_keys(target_email);
create index idx_access_keys_target_brand on public.access_keys(target_brand_id);
create index idx_access_keys_plan on public.access_keys(plan_id);
create index idx_access_keys_redeemed_by on public.access_keys(redeemed_by);
create index idx_access_keys_created_by on public.access_keys(created_by);
create index idx_plans_is_active on public.plans(is_active);
create index idx_brand_entitlements_brand on public.brand_entitlements(brand_id);
create index idx_brand_entitlements_plan on public.brand_entitlements(plan_id);
create index idx_brand_entitlements_status on public.brand_entitlements(status);
create index idx_brand_entitlements_source on public.brand_entitlements(source);
create index idx_brand_entitlements_granted_by on public.brand_entitlements(granted_by);
create index idx_questions_section on public.questions(section_id);
create index idx_intake_sessions_brand on public.intake_sessions(brand_id);
create index idx_intake_sessions_status on public.intake_sessions(status);
create index idx_intake_sessions_locked_by on public.intake_sessions(locked_by);
create index idx_intake_answers_session on public.intake_answers(session_id);
create index idx_intake_answers_question on public.intake_answers(question_id);
create index idx_intake_answers_updated_by on public.intake_answers(updated_by);
create index idx_intake_snapshots_session on public.intake_snapshots(session_id);
create index idx_intake_snapshots_brand on public.intake_snapshots(brand_id);
create index idx_brand_modules_brand on public.brand_modules(brand_id);
create index idx_brand_modules_status on public.brand_modules(status);
create index idx_brand_modules_assigned_to on public.brand_modules(assigned_to);
create index idx_brand_modules_supervisor on public.brand_modules(supervisor_id);
create index idx_files_brand on public.files(brand_id);
create index idx_files_status on public.files(status);
create index idx_files_visibility on public.files(visibility);
create index idx_files_uploaded_by on public.files(uploaded_by);
create index idx_module_artifacts_module on public.module_artifacts(module_id);
create index idx_module_artifacts_file on public.module_artifacts(file_id);
create index idx_module_artifacts_status on public.module_artifacts(status);
create index idx_module_artifacts_uploaded_by on public.module_artifacts(uploaded_by);
create index idx_module_reviews_module on public.module_reviews(module_id);
create index idx_module_reviews_reviewer on public.module_reviews(reviewer_id);
create index idx_module_reviews_review_type on public.module_reviews(review_type);
create index idx_module_reviews_decision on public.module_reviews(decision);
create index idx_change_requests_brand on public.change_requests(brand_id);
create index idx_change_requests_question on public.change_requests(question_id);
create index idx_change_requests_requested_by on public.change_requests(requested_by);
create index idx_change_requests_reviewed_by on public.change_requests(reviewed_by);
create index idx_change_requests_status on public.change_requests(status);
create index idx_change_requests_target_type on public.change_requests(target_type);
create index idx_knowledge_bases_brand on public.knowledge_bases(brand_id);
create index idx_knowledge_bases_status on public.knowledge_bases(status);
create index idx_knowledge_files_brand on public.knowledge_files(brand_id);
create index idx_knowledge_files_module on public.knowledge_files(module_id);
create index idx_knowledge_files_file on public.knowledge_files(file_id);
create index idx_knowledge_files_rag_status on public.knowledge_files(rag_status);
create index idx_knowledge_files_approved_by_supervisor on public.knowledge_files(approved_by_supervisor);
create index idx_knowledge_files_approved_by_platform_owner on public.knowledge_files(approved_by_platform_owner);
create index idx_agents_is_active on public.agents(is_active);
create index idx_agent_entitlements_brand on public.agent_entitlements(brand_id);
create index idx_agent_entitlements_agent on public.agent_entitlements(agent_id);
create index idx_agent_entitlements_plan on public.agent_entitlements(plan_id);
create index idx_agent_entitlements_status on public.agent_entitlements(status);
create index idx_agent_runs_brand on public.agent_runs(brand_id);
create index idx_agent_runs_agent on public.agent_runs(agent_id);
create index idx_agent_runs_user on public.agent_runs(user_id);
create index idx_audit_logs_brand on public.audit_logs(brand_id);
create index idx_audit_logs_actor on public.audit_logs(actor_user_id);
create index idx_audit_logs_action on public.audit_logs(action);
create index idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);

-- =============================================================================
-- Migration 0002: access_keys.resend_email_id
-- =============================================================================
alter table public.access_keys
  add column if not exists resend_email_id text;

-- =============================================================================
-- Migration 0003: change_requests.reason
-- =============================================================================
alter table public.change_requests
  add column if not exists reason text;

-- =============================================================================
-- Migration 0004: private file bucket
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('bextudio-files', 'bextudio-files', false)
on conflict (id) do update set public = false;

-- =============================================================================
-- Migration 0005: knowledge_files brand+file uniqueness
-- =============================================================================
create unique index if not exists idx_knowledge_files_brand_file_unique
on public.knowledge_files(brand_id, file_id);

-- =============================================================================
-- Migration 0006: tighten users_profile.global_role
-- =============================================================================
update public.users_profile
   set global_role = 'REGISTERED_USER'
 where global_role is null;

alter table public.users_profile
  alter column global_role set default 'REGISTERED_USER',
  alter column global_role set not null;

alter table public.users_profile
  drop constraint if exists users_profile_global_role_check;

alter table public.users_profile
  add constraint users_profile_global_role_check
  check (
    global_role in (
      'REGISTERED_USER',
      'PLATFORM_OWNER',
      'SUPERVISOR',
      'INTERNAL_SPECIALIST'
    )
  );

-- =============================================================================
-- Migration 0007: intake builder status fields
-- =============================================================================
alter table public.question_sections
  add column if not exists is_active boolean not null default true;
alter table public.question_sections
  add column if not exists updated_at timestamptz default now();
alter table public.questions
  add column if not exists is_active boolean not null default true;
alter table public.questions
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_question_sections_active_order
  on public.question_sections(is_active, order_index);
create index if not exists idx_questions_section_active_order
  on public.questions(section_id, is_active, order_index);

-- =============================================================================
-- Migration 0008: deny-by-default RLS for all app-owned tables
-- =============================================================================
alter table public.users_profile enable row level security;
alter table public.brands enable row level security;
alter table public.plans enable row level security;
alter table public.agents enable row level security;
alter table public.question_sections enable row level security;
alter table public.questions enable row level security;
alter table public.brand_memberships enable row level security;
alter table public.access_keys enable row level security;
alter table public.brand_entitlements enable row level security;
alter table public.intake_sessions enable row level security;
alter table public.intake_answers enable row level security;
alter table public.intake_snapshots enable row level security;
alter table public.brand_modules enable row level security;
alter table public.files enable row level security;
alter table public.module_artifacts enable row level security;
alter table public.module_reviews enable row level security;
alter table public.change_requests enable row level security;
alter table public.knowledge_bases enable row level security;
alter table public.knowledge_files enable row level security;
alter table public.agent_entitlements enable row level security;
alter table public.agent_runs enable row level security;
alter table public.audit_logs enable row level security;

alter table public.users_profile force row level security;
alter table public.brands force row level security;
alter table public.plans force row level security;
alter table public.agents force row level security;
alter table public.question_sections force row level security;
alter table public.questions force row level security;
alter table public.brand_memberships force row level security;
alter table public.access_keys force row level security;
alter table public.brand_entitlements force row level security;
alter table public.intake_sessions force row level security;
alter table public.intake_answers force row level security;
alter table public.intake_snapshots force row level security;
alter table public.brand_modules force row level security;
alter table public.files force row level security;
alter table public.module_artifacts force row level security;
alter table public.module_reviews force row level security;
alter table public.change_requests force row level security;
alter table public.knowledge_bases force row level security;
alter table public.knowledge_files force row level security;
alter table public.agent_entitlements force row level security;
alter table public.agent_runs force row level security;
alter table public.audit_logs force row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

alter table storage.objects enable row level security;
alter table storage.objects force row level security;

-- =============================================================================
-- Migration 0009: performance indexes
-- =============================================================================
create index if not exists idx_brand_memberships_user_status_brand
on public.brand_memberships(user_id, status, brand_id);
create index if not exists idx_brand_entitlements_brand_status_window
on public.brand_entitlements(brand_id, status, starts_at, expires_at);
create index if not exists idx_intake_sessions_brand_status_created
on public.intake_sessions(brand_id, status, created_at desc);
create index if not exists idx_brand_modules_brand_status_updated
on public.brand_modules(brand_id, status, updated_at desc);
create index if not exists idx_brand_modules_assigned_updated
on public.brand_modules(assigned_to, updated_at desc);
create index if not exists idx_module_artifacts_module_version_created
on public.module_artifacts(module_id, version desc, created_at desc);
create index if not exists idx_module_reviews_module_created
on public.module_reviews(module_id, created_at desc);
create index if not exists idx_files_brand_status_created
on public.files(brand_id, status, created_at desc);
create index if not exists idx_change_requests_brand_status_created
on public.change_requests(brand_id, status, created_at desc);
create index if not exists idx_agent_runs_brand_agent_created
on public.agent_runs(brand_id, agent_id, created_at desc);
create index if not exists idx_audit_logs_brand_created
on public.audit_logs(brand_id, created_at desc);

-- =============================================================================
-- Migration 0010: rate_limits
-- =============================================================================
create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  identifier_hash text not null,
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket, identifier_hash, window_start)
);

create index if not exists idx_rate_limits_bucket_identifier_window
on public.rate_limits(bucket, identifier_hash, window_start desc);
create index if not exists idx_rate_limits_window_start
on public.rate_limits(window_start);

alter table public.rate_limits enable row level security;
alter table public.rate_limits force row level security;
revoke all on table public.rate_limits from anon, authenticated;

create or replace function public.increment_rate_limit(
  p_bucket text,
  p_identifier_hash text,
  p_window_start timestamptz
)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.rate_limits (bucket, identifier_hash, window_start, count)
  values (p_bucket, p_identifier_hash, p_window_start, 1)
  on conflict (bucket, identifier_hash, window_start)
  do update
     set count = public.rate_limits.count + 1,
         updated_at = now()
  returning count;
$$;

revoke all on function public.increment_rate_limit(text, text, timestamptz)
from public, anon, authenticated;
grant execute on function public.increment_rate_limit(text, text, timestamptz)
to service_role;

-- =============================================================================
-- Migration 0011: demo_requests
-- =============================================================================
create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users_profile(id) on delete set null,
  email text not null,
  message text,
  status text not null default 'REQUESTED',
  reviewed_by uuid references public.users_profile(id),
  reviewed_at timestamptz,
  resolution_note text,
  approved_access_key_id uuid references public.access_keys(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_demo_requests_status_created_at
on public.demo_requests(status, created_at desc);
create index if not exists idx_demo_requests_user_id
on public.demo_requests(user_id);

alter table public.demo_requests enable row level security;
alter table public.demo_requests force row level security;
revoke all on table public.demo_requests from anon, authenticated;

-- =============================================================================
-- Migration 0012: pgvector knowledge_chunks
-- =============================================================================
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

-- =============================================================================
-- Migration 0013: brand_api_keys
-- =============================================================================
create table if not exists public.brand_api_keys (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  provider text not null default 'OPENROUTER',
  encrypted_key text not null,
  label text,
  is_active boolean not null default true,
  created_by uuid references public.users_profile(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (brand_id, provider)
);

create index if not exists idx_brand_api_keys_brand on public.brand_api_keys(brand_id);
alter table public.brand_api_keys enable row level security;
alter table public.brand_api_keys force row level security;

-- =============================================================================
-- Migration 0014: brand_icons (public bucket + icon_path)
-- =============================================================================
alter table public.brands
  add column if not exists icon_path text;

insert into storage.buckets (id, name, public)
values ('brand-icons', 'brand-icons', true)
on conflict (id) do update set public = true;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'brand_icons_public_read'
  ) then
    create policy brand_icons_public_read on storage.objects
      for select
      using (bucket_id = 'brand-icons');
  end if;
end $$;

-- =============================================================================
-- Migration 0015: AI Studio ops (budgets, default models, usage ledger,
--                 private agent-images bucket)
-- =============================================================================
alter table public.brands
  add column if not exists monthly_budget_cents integer,
  add column if not exists default_text_model text,
  add column if not exists default_image_model text;

create table if not exists public.agent_run_usage (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.agent_runs(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  kind text not null check (kind in ('TEXT','IMAGE','EMBEDDING')),
  model text not null,
  prompt_tokens int,
  completion_tokens int,
  image_count int,
  cost_cents numeric(14,4) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_run_usage_brand_month
  on public.agent_run_usage (brand_id, created_at desc);
create index if not exists idx_agent_run_usage_run
  on public.agent_run_usage (run_id);

alter table public.agent_run_usage enable row level security;

insert into storage.buckets (id, name, public)
values ('agent-images', 'agent-images', false)
on conflict (id) do update set public = false;

-- =============================================================================
-- Tell PostgREST (the API layer Supabase JS talks to) to reload its schema
-- cache so the brand-new columns and tables are visible immediately. Without
-- this, the JS client keeps the old schema and you get PGRST205 "Could not
-- find the table" for ~10 minutes.
-- =============================================================================
notify pgrst, 'reload schema';

-- DONE. Restart `npm run dev` and refresh the browser.
