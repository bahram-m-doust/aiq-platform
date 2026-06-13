-- GENERATED FILE. DO NOT EDIT DIRECTLY.
-- Source: numbered SQL files in supabase/migrations.
-- Latest migration: 0046_comment_highlights.sql
-- Regenerate with: npm run db:generate-bundles

-- BEGIN 0001_initial_schema.sql
create extension if not exists pgcrypto;

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
-- END 0001_initial_schema.sql

-- BEGIN 0002_add_access_key_resend_email_id.sql
alter table public.access_keys
  add column if not exists resend_email_id text;
-- END 0002_add_access_key_resend_email_id.sql

-- BEGIN 0003_add_change_request_reason.sql
alter table public.change_requests
  add column if not exists reason text;
-- END 0003_add_change_request_reason.sql

-- BEGIN 0004_create_private_file_bucket.sql
insert into storage.buckets (id, name, public)
values ('bextudio-files', 'bextudio-files', false)
on conflict (id) do update
set public = false;
-- END 0004_create_private_file_bucket.sql

-- BEGIN 0005_unique_knowledge_files_brand_file.sql
create unique index if not exists idx_knowledge_files_brand_file_unique
on public.knowledge_files(brand_id, file_id);
-- END 0005_unique_knowledge_files_brand_file.sql

-- BEGIN 0006_tighten_users_profile_role.sql
-- Tighten users_profile.global_role: ensure default is enforced, no nulls remain,
-- and only known role values are accepted.

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
-- END 0006_tighten_users_profile_role.sql

-- BEGIN 0007_intake_builder_status.sql
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
-- END 0007_intake_builder_status.sql

-- BEGIN 0008_enable_rls_deny_by_default.sql
-- Security-first MVP hardening:
-- Enable deny-by-default RLS for all app-owned public tables. No permissive
-- anon/authenticated policies are created in this pass; server-side app code
-- continues to use the Supabase service role, which bypasses RLS.

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

insert into storage.buckets (id, name, public)
values ('bextudio-files', 'bextudio-files', false)
on conflict (id) do update
set public = false;

-- Supabase Cloud owns storage.objects as supabase_storage_admin and enables
-- RLS there by default. App migrations must not try to alter that table.
-- END 0008_enable_rls_deny_by_default.sql

-- BEGIN 0009_performance_indexes.sql
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
-- END 0009_performance_indexes.sql

-- BEGIN 0010_rate_limits.sql
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
-- END 0010_rate_limits.sql

-- BEGIN 0011_demo_requests.sql
-- Demo Request flow: lets a signed-in user without brand access ask the
-- platform owner for a DEMO_ACCESS key. Admin acts on requests from
-- /admin/demo-requests.

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
-- END 0011_demo_requests.sql

-- BEGIN 0012_pgvector_knowledge_chunks.sql
create extension if not exists vector;

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
-- END 0012_pgvector_knowledge_chunks.sql

-- BEGIN 0013_brand_api_keys.sql
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
-- END 0013_brand_api_keys.sql

-- BEGIN 0014_brand_icons.sql
-- Brand icons: PNG logos uploaded by platform owners

alter table public.brands
  add column if not exists icon_path text;

-- Public bucket so the icon can be rendered directly from <img src>
insert into storage.buckets (id, name, public)
values ('brand-icons', 'brand-icons', true)
on conflict (id) do update set public = true;

-- Public read for brand icons
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
exception
  when insufficient_privilege then
    raise notice 'Skipping storage.objects policy creation; configure it through the Storage UI.';
end $$;
-- END 0014_brand_icons.sql

-- BEGIN 0015_openrouter_ops.sql
-- OpenRouter ops layer: per-brand budgets, default models, usage ledger

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

-- Service role bypasses RLS; no client-facing policies needed
-- (admin client is used for all reads/writes in app code).

-- Bucket for generated agent images (private; signed-url reads)
insert into storage.buckets (id, name, public)
values ('agent-images', 'agent-images', false)
on conflict (id) do update set public = false;
-- END 0015_openrouter_ops.sql

-- BEGIN 0018_ensure_brand_ops_columns.sql
-- Defensive backfill: guarantee brand-ops columns/tables exist.
--
-- The admin "Brand icons" page (reads brands.icon_path, added in 0014) and the
-- dashboard usage page (reads brands.monthly_budget_cents + agent_run_usage,
-- added in 0015) were both failing with Postgres error 42703 (undefined_column)
-- on databases where migrations 0014/0015 had not been applied.
--
-- Everything below is idempotent (if not exists / on conflict), so it is a
-- no-op on a healthy database and a self-heal on one that is missing the
-- brand-ops columns, table, or storage buckets.

alter table public.brands
  add column if not exists icon_path text,
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

-- Storage buckets (idempotent): brand-icons is public, agent-images is private.
insert into storage.buckets (id, name, public)
values ('brand-icons', 'brand-icons', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('agent-images', 'agent-images', false)
on conflict (id) do update set public = false;
-- END 0018_ensure_brand_ops_columns.sql

-- BEGIN 0019_fast_intake_autosave.sql
create or replace function public.autosave_intake_answer_fast(
  p_session_id uuid,
  p_question_id uuid,
  p_auth_user_id uuid,
  p_value jsonb
)
returns table (
  ok boolean,
  message text,
  question_id uuid,
  answer_id uuid,
  previous_value jsonb,
  value jsonb,
  input_type text,
  brand_id uuid,
  actor_profile_id uuid,
  actor_role text,
  completion_percent integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_session record;
  v_question record;
  v_has_access boolean;
  v_kind text;
  v_text text;
  v_normalized jsonb;
  v_stored_value jsonb;
  v_previous_value jsonb;
  v_answer_id uuid;
  v_answer_value jsonb;
  v_total_questions integer;
  v_answered_questions integer;
  v_completion_percent integer;
begin
  if p_session_id is null or p_question_id is null or p_auth_user_id is null then
    return query
      select false, 'The intake answer could not be saved.', null::uuid,
             null::uuid, null::jsonb, null::jsonb, null::text, null::uuid,
             null::uuid, null::text, null::integer;
    return;
  end if;

  select id, global_role
    into v_actor
    from public.users_profile
   where auth_user_id = p_auth_user_id;

  if not found then
    return query
      select false, 'The intake answer could not be saved.', null::uuid,
             null::uuid, null::jsonb, null::jsonb, null::text, null::uuid,
             null::uuid, null::text, null::integer;
    return;
  end if;

  select s.id, s.brand_id, s.status, s.locked_at
    into v_session
    from public.intake_sessions s
   where s.id = p_session_id;

  if not found then
    return query
      select false, 'The intake answer could not be saved.', null::uuid,
             null::uuid, null::jsonb, null::jsonb, null::text, null::uuid,
             v_actor.id, v_actor.global_role, null::integer;
    return;
  end if;

  if v_session.status = 'LOCKED' or v_session.locked_at is not null then
    return query
      select false, 'This intake session is locked and cannot be edited.',
             null::uuid, null::uuid, null::jsonb, null::jsonb, null::text,
             v_session.brand_id, v_actor.id, v_actor.global_role,
             null::integer;
    return;
  end if;

  select q.id, q.input_type
    into v_question
    from public.questions q
    join public.question_sections s on s.id = q.section_id
   where q.id = p_question_id
     and q.is_active = true
     and s.is_active = true;

  if not found then
    return query
      select false, 'The intake question could not be found.', null::uuid,
             null::uuid, null::jsonb, null::jsonb, null::text,
             v_session.brand_id, v_actor.id, v_actor.global_role,
             null::integer;
    return;
  end if;

  select (
    exists (
      select 1
       where v_actor.global_role = 'PLATFORM_OWNER'
    )
    or exists (
      select 1
        from public.brand_memberships m
        join public.brand_entitlements e on e.brand_id = m.brand_id
       where m.user_id = v_actor.id
         and m.brand_id = v_session.brand_id
         and m.status = 'ACTIVE'
         and m.role in ('OWNER', 'EXECUTIVE_MANAGER')
         and e.status = 'ACTIVE'
         and (e.starts_at is null or e.starts_at <= now())
         and (e.expires_at is null or e.expires_at > now())
    )
  )
  into v_has_access;

  if not v_has_access then
    return query
      select false, 'You do not have permission to answer this intake.',
             null::uuid, null::uuid, null::jsonb, null::jsonb, null::text,
             v_session.brand_id, v_actor.id, v_actor.global_role,
             null::integer;
    return;
  end if;

  v_kind := lower(trim(v_question.input_type));

  if v_kind in ('checkbox', 'boolean') then
    if jsonb_typeof(p_value) = 'boolean' then
      v_normalized := p_value;
    elsif jsonb_typeof(p_value) = 'string' then
      v_normalized := to_jsonb(lower(trim(p_value #>> '{}')) in ('1', 'true', 'yes', 'on'));
    else
      v_normalized := 'false'::jsonb;
    end if;
  elsif v_kind in (
    'multi_select',
    'multi-select',
    'multiselect',
    'checkbox_group',
    'checkbox-group'
  ) then
    if jsonb_typeof(p_value) = 'array' then
      select coalesce(jsonb_agg(item order by item), '[]'::jsonb)
        into v_normalized
        from (
          select distinct trim(raw_item) as item
            from jsonb_array_elements_text(p_value) as raw_items(raw_item)
           where trim(raw_item) <> ''
        ) normalized_items;
    elsif jsonb_typeof(p_value) = 'string' and trim(p_value #>> '{}') <> '' then
      v_normalized := jsonb_build_array(trim(p_value #>> '{}'));
    else
      v_normalized := '[]'::jsonb;
    end if;
  elsif v_kind in ('number', 'numeric') then
    v_text := trim(coalesce(p_value #>> '{}', ''));

    if p_value is null or p_value = 'null'::jsonb or v_text = '' then
      v_normalized := 'null'::jsonb;
    elsif jsonb_typeof(p_value) = 'number' then
      v_normalized := p_value;
    elsif v_text ~ '^-?((\d+(\.\d*)?)|(\.\d+))([eE][+-]?\d+)?$' then
      v_normalized := to_jsonb(v_text::numeric);
    else
      v_normalized := 'null'::jsonb;
    end if;
  else
    if jsonb_typeof(p_value) = 'string' then
      v_text := trim(p_value #>> '{}');
    else
      v_text := '';
    end if;

    if v_text = '' then
      v_normalized := 'null'::jsonb;
    else
      v_normalized := to_jsonb(v_text);
    end if;
  end if;

  v_stored_value := jsonb_build_object('value', v_normalized);

  select a.value
    into v_previous_value
    from public.intake_answers a
   where a.session_id = p_session_id
     and a.question_id = p_question_id;

  insert into public.intake_answers (
    session_id,
    question_id,
    value,
    updated_by,
    updated_at
  )
  values (
    p_session_id,
    p_question_id,
    v_stored_value,
    v_actor.id,
    now()
  )
  on conflict (session_id, question_id)
  do update
     set value = excluded.value,
         updated_by = excluded.updated_by,
         updated_at = excluded.updated_at
  returning id, value
  into v_answer_id, v_answer_value;

  select
    count(*),
    count(*) filter (
      where a.value ? 'value'
        and case jsonb_typeof(a.value -> 'value')
          when 'array' then jsonb_array_length(a.value -> 'value') > 0
          when 'string' then trim(a.value ->> 'value') <> ''
          when 'number' then true
          when 'boolean' then true
          else false
        end
    )
    into v_total_questions, v_answered_questions
    from public.question_sections s
    join public.questions q on q.section_id = s.id
    left join public.intake_answers a
      on a.session_id = p_session_id
     and a.question_id = q.id
   where s.is_active = true
     and q.is_active = true;

  if v_total_questions > 0 then
    v_completion_percent :=
      round((v_answered_questions::numeric / v_total_questions::numeric) * 100)::integer;
  else
    v_completion_percent := 0;
  end if;

  update public.intake_sessions
     set completion_percent = v_completion_percent,
         updated_at = now()
   where id = p_session_id;

  return query
    select true, null::text, p_question_id, v_answer_id, v_previous_value,
           v_answer_value, v_question.input_type, v_session.brand_id,
           v_actor.id, v_actor.global_role, v_completion_percent;
end;
$$;

revoke all on function public.autosave_intake_answer_fast(uuid, uuid, uuid, jsonb)
from public, anon, authenticated;

grant execute on function public.autosave_intake_answer_fast(uuid, uuid, uuid, jsonb)
to service_role;

notify pgrst, 'reload schema';
-- END 0019_fast_intake_autosave.sql

-- BEGIN 0020_batch_intake_autosave.sql
create or replace function public.autosave_intake_answers_batch(
  p_session_id uuid,
  p_auth_user_id uuid,
  p_answers jsonb
)
returns table (
  ok boolean,
  message text,
  question_id uuid,
  answer_id uuid,
  previous_value jsonb,
  value jsonb,
  input_type text,
  brand_id uuid,
  actor_profile_id uuid,
  actor_role text,
  completion_percent integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_session record;
  v_has_access boolean;
  v_item jsonb;
  v_ord integer;
  v_question_id_text text;
  v_question_id uuid;
  v_input_count integer;
  v_upsert record;
  v_total_questions integer;
  v_answered_questions integer;
  v_completion_percent integer;
begin
  if p_session_id is null or p_auth_user_id is null then
    return query
      select false, 'The intake answer could not be saved.', null::uuid,
             null::uuid, null::jsonb, null::jsonb, null::text, null::uuid,
             null::uuid, null::text, null::integer;
    return;
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    return query
      select false, 'The intake answer could not be saved.', null::uuid,
             null::uuid, null::jsonb, null::jsonb, null::text, null::uuid,
             null::uuid, null::text, null::integer;
    return;
  end if;

  select p.id, p.global_role
    into v_actor
    from public.users_profile p
   where p.auth_user_id = p_auth_user_id;

  if not found then
    return query
      select false, 'The intake answer could not be saved.', null::uuid,
             null::uuid, null::jsonb, null::jsonb, null::text, null::uuid,
             null::uuid, null::text, null::integer;
    return;
  end if;

  select s.id, s.brand_id, s.status, s.locked_at
    into v_session
    from public.intake_sessions s
   where s.id = p_session_id;

  if not found then
    return query
      select false, 'The intake answer could not be saved.', null::uuid,
             null::uuid, null::jsonb, null::jsonb, null::text, null::uuid,
             v_actor.id, v_actor.global_role, null::integer;
    return;
  end if;

  if v_session.status = 'LOCKED' or v_session.locked_at is not null then
    return query
      select false, 'This intake session is locked and cannot be edited.',
             null::uuid, null::uuid, null::jsonb, null::jsonb, null::text,
             v_session.brand_id, v_actor.id, v_actor.global_role,
             null::integer;
    return;
  end if;

  select (
    exists (
      select 1
       where v_actor.global_role = 'PLATFORM_OWNER'
    )
    or exists (
      select 1
        from public.brand_memberships m
        join public.brand_entitlements e on e.brand_id = m.brand_id
       where m.user_id = v_actor.id
         and m.brand_id = v_session.brand_id
         and m.status = 'ACTIVE'
         and m.role in ('OWNER', 'EXECUTIVE_MANAGER')
         and e.status = 'ACTIVE'
         and (e.starts_at is null or e.starts_at <= now())
         and (e.expires_at is null or e.expires_at > now())
    )
  )
  into v_has_access;

  if not v_has_access then
    return query
      select false, 'You do not have permission to answer this intake.',
             null::uuid, null::uuid, null::jsonb, null::jsonb, null::text,
             v_session.brand_id, v_actor.id, v_actor.global_role,
             null::integer;
    return;
  end if;

  create temporary table if not exists pg_temp.autosave_intake_batch_input (
    ord integer not null,
    question_id uuid,
    raw_value jsonb,
    input_type text,
    normalized_value jsonb,
    stored_value jsonb,
    previous_value jsonb,
    answer_id uuid,
    answer_value jsonb
  ) on commit drop;

  truncate table pg_temp.autosave_intake_batch_input;

  for v_item, v_ord in
    select items.value, items.ordinality::integer
      from jsonb_array_elements(p_answers) with ordinality as items(value, ordinality)
  loop
    v_question_id_text := coalesce(
      nullif(trim(v_item ->> 'question_id'), ''),
      nullif(trim(v_item ->> 'questionId'), '')
    );
    v_question_id := null;

    if v_question_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_question_id := v_question_id_text::uuid;
    end if;

    insert into pg_temp.autosave_intake_batch_input (
      ord,
      question_id,
      raw_value
    )
    values (
      v_ord,
      v_question_id,
      coalesce(v_item -> 'value', 'null'::jsonb)
    );
  end loop;

  delete from pg_temp.autosave_intake_batch_input older
  using pg_temp.autosave_intake_batch_input newer
  where older.question_id = newer.question_id
    and older.ord < newer.ord;

  select count(*)
    into v_input_count
    from pg_temp.autosave_intake_batch_input;

  if v_input_count = 0 or exists (
    select 1 from pg_temp.autosave_intake_batch_input where question_id is null
  ) then
    return query
      select false, 'The intake answer could not be saved.', null::uuid,
             null::uuid, null::jsonb, null::jsonb, null::text,
             v_session.brand_id, v_actor.id, v_actor.global_role,
             null::integer;
    return;
  end if;

  update pg_temp.autosave_intake_batch_input i
     set input_type = q.input_type
    from public.questions q
    join public.question_sections s on s.id = q.section_id
   where i.question_id = q.id
     and q.is_active = true
     and s.is_active = true;

  if exists (
    select 1 from pg_temp.autosave_intake_batch_input where input_type is null
  ) then
    return query
      select false, 'The intake question could not be found.', null::uuid,
             null::uuid, null::jsonb, null::jsonb, null::text,
             v_session.brand_id, v_actor.id, v_actor.global_role,
             null::integer;
    return;
  end if;

  update pg_temp.autosave_intake_batch_input i
     set normalized_value =
       case
         when lower(trim(i.input_type)) in ('checkbox', 'boolean') then
           case
             when jsonb_typeof(i.raw_value) = 'boolean' then i.raw_value
             when jsonb_typeof(i.raw_value) = 'string' then
               to_jsonb(lower(trim(i.raw_value #>> '{}')) in ('1', 'true', 'yes', 'on'))
             else 'false'::jsonb
           end
         when lower(trim(i.input_type)) in (
           'multi_select',
           'multi-select',
           'multiselect',
           'checkbox_group',
           'checkbox-group'
         ) then
           case
             when jsonb_typeof(i.raw_value) = 'array' then (
               select coalesce(jsonb_agg(item order by item), '[]'::jsonb)
                 from (
                   select distinct trim(raw_item) as item
                     from jsonb_array_elements_text(i.raw_value) as raw_items(raw_item)
                    where trim(raw_item) <> ''
                 ) normalized_items
             )
             when jsonb_typeof(i.raw_value) = 'string'
              and trim(i.raw_value #>> '{}') <> '' then
               jsonb_build_array(trim(i.raw_value #>> '{}'))
             else '[]'::jsonb
           end
         when lower(trim(i.input_type)) in ('number', 'numeric') then
           case
             when i.raw_value is null
               or i.raw_value = 'null'::jsonb
               or trim(coalesce(i.raw_value #>> '{}', '')) = '' then
               'null'::jsonb
             when jsonb_typeof(i.raw_value) = 'number' then i.raw_value
             when trim(i.raw_value #>> '{}') ~ '^-?((\d+(\.\d*)?)|(\.\d+))([eE][+-]?\d+)?$' then
               to_jsonb((trim(i.raw_value #>> '{}'))::numeric)
             else 'null'::jsonb
           end
         else
           case
             when jsonb_typeof(i.raw_value) = 'string'
              and trim(i.raw_value #>> '{}') <> '' then
               to_jsonb(trim(i.raw_value #>> '{}'))
             else 'null'::jsonb
           end
       end;

  update pg_temp.autosave_intake_batch_input
     set stored_value = jsonb_build_object('value', normalized_value);

  update pg_temp.autosave_intake_batch_input i
     set previous_value = a.value
    from public.intake_answers a
   where a.session_id = p_session_id
     and a.question_id = i.question_id;

  for v_upsert in
    insert into public.intake_answers (
      session_id,
      question_id,
      value,
      updated_by,
      updated_at
    )
    select
      p_session_id,
      i.question_id,
      i.stored_value,
      v_actor.id,
      now()
    from pg_temp.autosave_intake_batch_input i
    order by i.ord
    on conflict (session_id, question_id)
    do update
       set value = excluded.value,
           updated_by = excluded.updated_by,
           updated_at = excluded.updated_at
    returning question_id, id, value
  loop
    update pg_temp.autosave_intake_batch_input i
       set answer_id = v_upsert.id,
           answer_value = v_upsert.value
     where i.question_id = v_upsert.question_id;
  end loop;

  select
    count(*),
    count(*) filter (
      where a.value ? 'value'
        and case jsonb_typeof(a.value -> 'value')
          when 'array' then jsonb_array_length(a.value -> 'value') > 0
          when 'string' then trim(a.value ->> 'value') <> ''
          when 'number' then true
          when 'boolean' then true
          else false
        end
    )
    into v_total_questions, v_answered_questions
    from public.question_sections s
    join public.questions q on q.section_id = s.id
    left join public.intake_answers a
      on a.session_id = p_session_id
     and a.question_id = q.id
   where s.is_active = true
     and q.is_active = true;

  if v_total_questions > 0 then
    v_completion_percent :=
      round((v_answered_questions::numeric / v_total_questions::numeric) * 100)::integer;
  else
    v_completion_percent := 0;
  end if;

  update public.intake_sessions
     set completion_percent = v_completion_percent,
         updated_at = now()
   where id = p_session_id;

  return query
    select true, null::text, i.question_id, i.answer_id, i.previous_value,
           i.answer_value, i.input_type, v_session.brand_id, v_actor.id,
           v_actor.global_role, v_completion_percent
      from pg_temp.autosave_intake_batch_input i
     order by i.ord;
end;
$$;

revoke all on function public.autosave_intake_answers_batch(uuid, uuid, jsonb)
from public, anon, authenticated;

grant execute on function public.autosave_intake_answers_batch(uuid, uuid, jsonb)
to service_role;

notify pgrst, 'reload schema';
-- END 0020_batch_intake_autosave.sql

-- BEGIN 0021_stakeholder_interviews.sql
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
-- END 0021_stakeholder_interviews.sql

-- BEGIN 0022_stakeholder_annotation_replies.sql
-- Threaded replies for stakeholder-interview annotations.
-- A reply has parent_id set to the root annotation; root comments keep
-- parent_id null and are the ones pinned on the PDF.

alter table public.stakeholder_interview_annotations
  add column if not exists parent_id uuid
  references public.stakeholder_interview_annotations(id) on delete cascade;

create index if not exists stakeholder_interview_annotations_parent_idx
  on public.stakeholder_interview_annotations (parent_id);
-- END 0022_stakeholder_annotation_replies.sql

-- BEGIN 0023_plan_credits.sql
-- 0023_plan_credits.sql
-- Adds a per-plan credit allowance. Each brand inherits the credits of its
-- active plan; the value is surfaced in the dashboard sidebar footer.

alter table public.plans
  add column if not exists credits integer not null default 0;

comment on column public.plans.credits is
  'Credit allowance granted to brands on this plan. Surfaced in the dashboard sidebar.';

-- Reload PostgREST so the new column is selectable immediately.
notify pgrst, 'reload schema';
-- END 0023_plan_credits.sql

-- BEGIN 0024_brand_agent_settings.sql
-- Phase A: dynamic, admin-edited per-brand (and per-agent) system instructions.
--
-- Layered system prompt = Role (code) + Brand Instruction (this table) + Safety
-- guard (code) + RAG context. A row with agent_id = NULL is the brand-wide
-- default; a row with agent_id set overrides it for that one agent.

create table if not exists public.brand_agent_settings (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.brands(id) on delete cascade,
  agent_id    uuid references public.agents(id) on delete cascade, -- NULL = brand-wide default
  instruction text,
  is_enabled  boolean not null default true,
  updated_by  uuid references public.users_profile(id),
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- One row per (brand, agent). The brand-wide row (agent_id NULL) occupies a
-- distinct slot via a sentinel so it can coexist with per-agent overrides.
create unique index if not exists ux_brand_agent_settings_brand_agent
  on public.brand_agent_settings (
    brand_id,
    coalesce(agent_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists idx_brand_agent_settings_brand
  on public.brand_agent_settings (brand_id);

-- Deny-by-default RLS, consistent with the rest of the schema: no client-facing
-- policies; all access is through the service-role admin client in app code.
alter table public.brand_agent_settings enable row level security;
alter table public.brand_agent_settings force row level security;
-- END 0024_brand_agent_settings.sql

-- BEGIN 0025_futures_research.sql
-- Futures Research (Brand Research · step 3)
-- The Bextudio team uploads a PDF with the futures research we ran for the
-- brand — the trends and future scenarios shaping where the brand can go. The
-- client views it, leaves PDF-anchored annotations, and approves it, which
-- completes Brand Research (phase 1).
--
-- Mirrors the Stakeholder Interviews schema (step 2). One report per brand.
-- PDF bytes live in the shared private `files` table (bucket: bextudio-files).

create table public.futures_research_reports (
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

create unique index futures_research_reports_brand_id_key
  on public.futures_research_reports (brand_id);

-- PDF-anchored comments. Position is normalized (0..1) within a page so it
-- maps back onto the rendered page at any zoom/size. Threaded replies set
-- parent_id to the root annotation; root comments keep parent_id null.
create table public.futures_research_annotations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null
    references public.futures_research_reports(id) on delete cascade,
  parent_id uuid
    references public.futures_research_annotations(id) on delete cascade,
  author_id uuid references public.users_profile(id),
  page integer not null,
  pos_x numeric not null,
  pos_y numeric not null,
  body text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index futures_research_annotations_report_idx
  on public.futures_research_annotations (report_id);

create index futures_research_annotations_parent_idx
  on public.futures_research_annotations (parent_id);

-- Deny-by-default RLS; all access is through the service-role admin client
-- behind app-level authorization (matches the rest of the schema).
alter table public.futures_research_reports enable row level security;
alter table public.futures_research_annotations enable row level security;
-- END 0025_futures_research.sql

-- BEGIN 0026_futures_research_storyline.sql
-- Futures Research · optional Storyline output.
-- Alongside the analysis PDF, the Bextudio team can attach an interactive
-- Storyline (a single self-contained HTML file) that the client views inline.
-- Stored in the shared private `files` table (bucket: bextudio-files) and
-- streamed through an authorized route, same as the PDF.

alter table public.futures_research_reports
  add column if not exists storyline_file_id uuid
  references public.files(id) on delete set null;
-- END 0026_futures_research_storyline.sql

-- BEGIN 0027_atomic_workflows.sql
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
-- END 0027_atomic_workflows.sql

-- BEGIN 0028_ai_budget_reservations.sql
create table if not exists public.ai_usage_reservations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  kind text not null check (kind in ('TEXT', 'IMAGE', 'EMBEDDING')),
  reserved_cents numeric(14,4) not null check (reserved_cents >= 0),
  status text not null default 'RESERVED'
    check (status in ('RESERVED', 'SETTLED', 'RELEASED')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists idx_ai_usage_reservations_active
  on public.ai_usage_reservations (brand_id, status, expires_at);

alter table public.ai_usage_reservations enable row level security;
alter table public.ai_usage_reservations force row level security;

create or replace function public.reserve_ai_budget(
  p_brand_id uuid,
  p_kind text,
  p_reserved_cents numeric,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_budget integer;
  v_spent numeric;
  v_reserved numeric;
  v_id uuid;
begin
  if p_kind not in ('TEXT', 'IMAGE', 'EMBEDDING') then
    raise exception 'Unsupported AI usage kind.';
  end if;

  if p_reserved_cents < 0 or p_expires_at <= now() then
    raise exception 'Invalid AI budget reservation.';
  end if;

  select monthly_budget_cents
    into v_budget
    from public.brands
   where id = p_brand_id
   for update;

  if not found then
    raise exception 'Brand not found.';
  end if;

  select coalesce(sum(cost_cents), 0)
    into v_spent
    from public.agent_run_usage
   where brand_id = p_brand_id
     and created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';

  select coalesce(sum(reserved_cents), 0)
    into v_reserved
    from public.ai_usage_reservations
   where brand_id = p_brand_id
     and status = 'RESERVED'
     and expires_at > now();

  if v_budget is not null
     and v_spent + v_reserved + p_reserved_cents > v_budget then
    raise exception using
      errcode = 'P0001',
      message = 'AI_BUDGET_EXCEEDED';
  end if;

  insert into public.ai_usage_reservations (
    brand_id,
    kind,
    reserved_cents,
    expires_at
  )
  values (p_brand_id, p_kind, p_reserved_cents, p_expires_at)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.settle_ai_usage(
  p_reservation_id uuid,
  p_model text,
  p_prompt_tokens integer,
  p_completion_tokens integer,
  p_image_count integer,
  p_cost_cents numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservation public.ai_usage_reservations%rowtype;
  v_usage_id uuid;
begin
  select *
    into v_reservation
    from public.ai_usage_reservations
   where id = p_reservation_id
   for update;

  if not found or v_reservation.status <> 'RESERVED' then
    raise exception 'AI usage reservation is not active.';
  end if;

  insert into public.agent_run_usage (
    run_id,
    brand_id,
    kind,
    model,
    prompt_tokens,
    completion_tokens,
    image_count,
    cost_cents
  )
  values (
    null,
    v_reservation.brand_id,
    v_reservation.kind,
    p_model,
    p_prompt_tokens,
    p_completion_tokens,
    p_image_count,
    greatest(coalesce(p_cost_cents, 0), 0)
  )
  returning id into v_usage_id;

  update public.ai_usage_reservations
     set status = 'SETTLED',
         settled_at = now()
   where id = p_reservation_id;

  return v_usage_id;
end;
$$;

create or replace function public.release_ai_budget_reservation(
  p_reservation_id uuid
)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.ai_usage_reservations
     set status = 'RELEASED',
         settled_at = now()
   where id = p_reservation_id
     and status = 'RESERVED'
  returning true;
$$;

create or replace function public.attach_ai_usage_to_run(
  p_run_id uuid,
  p_usage_ids uuid[]
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_brand_id uuid;
  v_cost_cents numeric;
begin
  select brand_id
    into v_brand_id
    from public.agent_runs
   where id = p_run_id
   for update;

  if not found then
    raise exception 'Agent run not found.';
  end if;

  update public.agent_run_usage
     set run_id = p_run_id
   where id = any(p_usage_ids)
     and brand_id = v_brand_id
     and run_id is null;

  if (select count(*) from public.agent_run_usage where id = any(p_usage_ids) and run_id = p_run_id)
     <> coalesce(array_length(p_usage_ids, 1), 0) then
    raise exception 'AI usage rows could not be attached to this run.';
  end if;

  select coalesce(sum(cost_cents), 0)
    into v_cost_cents
    from public.agent_run_usage
   where id = any(p_usage_ids);

  update public.agent_runs
     set cost = v_cost_cents / 100
   where id = p_run_id;

  return v_cost_cents;
end;
$$;

revoke all on function public.reserve_ai_budget(uuid, text, numeric, timestamptz)
from public, anon, authenticated;
revoke all on function public.settle_ai_usage(uuid, text, integer, integer, integer, numeric)
from public, anon, authenticated;
revoke all on function public.release_ai_budget_reservation(uuid)
from public, anon, authenticated;
revoke all on function public.attach_ai_usage_to_run(uuid, uuid[])
from public, anon, authenticated;

grant execute on function public.reserve_ai_budget(uuid, text, numeric, timestamptz)
to service_role;
grant execute on function public.settle_ai_usage(uuid, text, integer, integer, integer, numeric)
to service_role;
grant execute on function public.release_ai_budget_reservation(uuid)
to service_role;
grant execute on function public.attach_ai_usage_to_run(uuid, uuid[])
to service_role;

notify pgrst, 'reload schema';
-- END 0028_ai_budget_reservations.sql

-- BEGIN 0029_atomic_file_workflows.sql
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
-- END 0029_atomic_file_workflows.sql

-- BEGIN 0030_atomic_module_review.sql
create or replace function public.transition_module_review(
  p_action text,
  p_module_id uuid,
  p_brand_id uuid,
  p_artifact_id uuid,
  p_file_id uuid,
  p_reviewer_id uuid,
  p_comment text
)
returns table (
  id uuid,
  module_id uuid,
  reviewer_id uuid,
  review_type text,
  decision text,
  comment text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_module_status text;
  v_artifact_status text;
  v_artifact_type text;
  v_file_status text;
begin
  select status
    into v_module_status
    from public.brand_modules
   where public.brand_modules.id = p_module_id
     and brand_id = p_brand_id
   for update;

  select ma.status, ma.artifact_type, f.status
    into v_artifact_status, v_artifact_type, v_file_status
    from public.module_artifacts ma
    join public.files f on f.id = ma.file_id
   where ma.id = p_artifact_id
     and ma.module_id = p_module_id
     and f.id = p_file_id
     and f.brand_id = p_brand_id
   for update of ma, f;

  if v_module_status is null or v_artifact_status is null then
    raise exception 'Module review resources were not found.';
  end if;

  if p_action = 'SEND_TO_CLIENT' then
    if v_artifact_type <> 'PDF'
       or v_artifact_status not in ('INTERNAL_DRAFT', 'SUPERVISOR_APPROVED') then
      raise exception 'A reviewable PDF artifact is required.';
    end if;

    update public.brand_modules
       set status = 'CLIENT_REVIEW', updated_at = now()
     where public.brand_modules.id = p_module_id;
    update public.module_artifacts
       set status = 'CLIENT_REVIEW'
     where public.module_artifacts.id = p_artifact_id;
    update public.files
       set visibility = 'CLIENT_REVIEW', status = 'CLIENT_REVIEW'
     where public.files.id = p_file_id;

    return query
      insert into public.module_reviews (
        module_id, reviewer_id, review_type, decision, comment
      )
      values (
        p_module_id, p_reviewer_id, 'SUPERVISOR',
        'APPROVED_FOR_CLIENT_REVIEW', null
      )
      returning
        module_reviews.id,
        module_reviews.module_id,
        module_reviews.reviewer_id,
        module_reviews.review_type,
        module_reviews.decision,
        module_reviews.comment,
        module_reviews.created_at;
  elsif p_action = 'CLIENT_APPROVE' then
    if v_module_status <> 'CLIENT_REVIEW'
       or v_artifact_status <> 'CLIENT_REVIEW'
       or v_file_status <> 'CLIENT_REVIEW' then
      raise exception 'Module is not in client review.';
    end if;

    update public.brand_modules
       set status = 'CLIENT_APPROVED', updated_at = now()
     where public.brand_modules.id = p_module_id;
    update public.module_artifacts
       set status = 'CLIENT_APPROVED'
     where public.module_artifacts.id = p_artifact_id;
    update public.files
       set status = 'CLIENT_APPROVED'
     where public.files.id = p_file_id;

    return query
      insert into public.module_reviews (
        module_id, reviewer_id, review_type, decision, comment
      )
      values (
        p_module_id, p_reviewer_id, 'CLIENT', 'APPROVED', p_comment
      )
      returning
        module_reviews.id,
        module_reviews.module_id,
        module_reviews.reviewer_id,
        module_reviews.review_type,
        module_reviews.decision,
        module_reviews.comment,
        module_reviews.created_at;
  elsif p_action = 'CLIENT_REQUEST_CHANGE' then
    if v_module_status <> 'CLIENT_REVIEW'
       or v_artifact_status <> 'CLIENT_REVIEW'
       or v_file_status <> 'CLIENT_REVIEW'
       or nullif(btrim(p_comment), '') is null then
      raise exception 'A client-review module and comment are required.';
    end if;

    update public.brand_modules
       set status = 'CLIENT_CHANGE_REQUESTED', updated_at = now()
     where public.brand_modules.id = p_module_id;

    return query
      insert into public.module_reviews (
        module_id, reviewer_id, review_type, decision, comment
      )
      values (
        p_module_id, p_reviewer_id, 'CLIENT', 'CHANGE_REQUESTED', p_comment
      )
      returning
        module_reviews.id,
        module_reviews.module_id,
        module_reviews.reviewer_id,
        module_reviews.review_type,
        module_reviews.decision,
        module_reviews.comment,
        module_reviews.created_at;
  else
    raise exception 'Unsupported module review action.';
  end if;
end;
$$;

revoke all on function public.transition_module_review(
  text, uuid, uuid, uuid, uuid, uuid, text
) from public, anon, authenticated;

grant execute on function public.transition_module_review(
  text, uuid, uuid, uuid, uuid, uuid, text
) to service_role;

notify pgrst, 'reload schema';
-- END 0030_atomic_module_review.sql

-- BEGIN 0031_atomic_rag_promotion.sql
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
-- END 0031_atomic_rag_promotion.sql

-- BEGIN 0032_storage_cleanup_outbox.sql
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
-- END 0032_storage_cleanup_outbox.sql

-- BEGIN 0033_atomic_brand_access_grants.sql
create or replace function public.grant_brand_access_atomic(
  p_brand_id uuid,
  p_plan_id uuid,
  p_source text,
  p_starts_at timestamptz,
  p_expires_at timestamptz,
  p_granted_by uuid,
  p_manual_reference text,
  p_internal_note text,
  p_idempotency_key text
)
returns table (
  entitlement_id uuid,
  entitlement_brand_id uuid,
  entitlement_plan_id uuid,
  entitlement_source text,
  entitlement_status text,
  entitlement_starts_at timestamptz,
  entitlement_expires_at timestamptz,
  entitlement_granted_by uuid,
  entitlement_manual_reference text,
  entitlement_internal_note text,
  entitlement_created_at timestamptz,
  included_agent_keys text[],
  matched_agent_keys text[],
  agent_entitlement_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entitlement public.brand_entitlements%rowtype;
  v_plan_agents jsonb;
  v_idempotency_key text := nullif(btrim(p_idempotency_key), '');
  v_included_agent_keys text[] := array[]::text[];
  v_matched_agent_keys text[] := array[]::text[];
  v_agent_entitlement_count integer := 0;
begin
  if p_source not in (
    'STRIPE', 'ACCESS_KEY', 'MANUAL_CASH', 'BANK_TRANSFER',
    'DEMO', 'PROMO', 'INTERNAL'
  ) then
    raise exception 'Unsupported entitlement source.';
  end if;
  if p_expires_at is not null and p_expires_at <= p_starts_at then
    raise exception 'Plan grant expiry must be after the start date.';
  end if;

  perform 1
    from public.brands
   where id = p_brand_id
   for update;
  if not found then
    raise exception 'Brand could not be found.';
  end if;

  if v_idempotency_key is not null then
    select *
      into v_entitlement
      from public.brand_entitlements
     where idempotency_key = v_idempotency_key
     for update;
  end if;

  if v_entitlement.id is null then
    select included_agents
      into v_plan_agents
      from public.plans
     where id = p_plan_id
       and is_active = true;
    if not found then
      raise exception 'Active plan could not be found.';
    end if;

    if v_idempotency_key is null then
      insert into public.brand_entitlements (
        brand_id,
        plan_id,
        source,
        status,
        starts_at,
        expires_at,
        granted_by,
        manual_reference,
        internal_note,
        idempotency_key
      )
      values (
        p_brand_id,
        p_plan_id,
        p_source,
        'ACTIVE',
        p_starts_at,
        p_expires_at,
        p_granted_by,
        nullif(btrim(p_manual_reference), ''),
        nullif(btrim(p_internal_note), ''),
        null
      )
      returning * into v_entitlement;
    else
      insert into public.brand_entitlements (
        brand_id,
        plan_id,
        source,
        status,
        starts_at,
        expires_at,
        granted_by,
        manual_reference,
        internal_note,
        idempotency_key
      )
      values (
        p_brand_id,
        p_plan_id,
        p_source,
        'ACTIVE',
        p_starts_at,
        p_expires_at,
        p_granted_by,
        nullif(btrim(p_manual_reference), ''),
        nullif(btrim(p_internal_note), ''),
        v_idempotency_key
      )
      on conflict (idempotency_key)
        where idempotency_key is not null
      do nothing
      returning * into v_entitlement;

      if v_entitlement.id is null then
        select *
          into v_entitlement
          from public.brand_entitlements
         where idempotency_key = v_idempotency_key
         for update;
      end if;
    end if;
  else
    select included_agents
      into v_plan_agents
      from public.plans
     where id = v_entitlement.plan_id;
  end if;

  if v_entitlement.id is null then
    raise exception 'Plan grant could not be created.';
  end if;
  if v_entitlement.brand_id <> p_brand_id
     or v_entitlement.plan_id <> p_plan_id
     or v_entitlement.source <> p_source then
    raise exception 'Idempotency key is already used by another plan grant.';
  end if;

  select coalesce(
    array_agg(distinct btrim(entry.value #>> '{}')
      order by btrim(entry.value #>> '{}')),
    array[]::text[]
  )
    into v_included_agent_keys
    from jsonb_array_elements(
      case
        when jsonb_typeof(v_plan_agents) = 'array' then v_plan_agents
        else '[]'::jsonb
      end
    )
      as entry(value)
   where jsonb_typeof(entry.value) = 'string'
     and nullif(btrim(entry.value #>> '{}'), '') is not null;

  select coalesce(array_agg(agent.key order by agent.key), array[]::text[])
    into v_matched_agent_keys
    from public.agents as agent
   where agent.is_active = true
     and agent.key = any(v_included_agent_keys);

  insert into public.agent_entitlements (
    brand_id,
    agent_id,
    plan_id,
    status,
    starts_at,
    expires_at
  )
  select
    v_entitlement.brand_id,
    agent.id,
    v_entitlement.plan_id,
    'LOCKED_BY_BRAIN',
    v_entitlement.starts_at,
    v_entitlement.expires_at
  from public.agents as agent
  where agent.is_active = true
    and agent.key = any(v_included_agent_keys)
  on conflict (brand_id, agent_id) do update
     set plan_id = excluded.plan_id,
         status = excluded.status,
         starts_at = excluded.starts_at,
         expires_at = excluded.expires_at;

  get diagnostics v_agent_entitlement_count = row_count;

  return query
    select
      v_entitlement.id,
      v_entitlement.brand_id,
      v_entitlement.plan_id,
      v_entitlement.source,
      v_entitlement.status,
      v_entitlement.starts_at,
      v_entitlement.expires_at,
      v_entitlement.granted_by,
      v_entitlement.manual_reference,
      v_entitlement.internal_note,
      v_entitlement.created_at,
      v_included_agent_keys,
      v_matched_agent_keys,
      v_agent_entitlement_count;
end;
$$;

revoke all on function public.grant_brand_access_atomic(
  uuid, uuid, text, timestamptz, timestamptz, uuid, text, text, text
) from public, anon, authenticated;

grant execute on function public.grant_brand_access_atomic(
  uuid, uuid, text, timestamptz, timestamptz, uuid, text, text, text
) to service_role;

notify pgrst, 'reload schema';
-- END 0033_atomic_brand_access_grants.sql

-- BEGIN 0034_atomic_rag_approval.sql
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
          false;
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
-- END 0034_atomic_rag_approval.sql

-- BEGIN 0035_release_race_hardening.sql
with ranked_requests as (
  select
    id,
    row_number() over (
      partition by user_id
      order by created_at asc, id asc
    ) as request_rank
  from public.demo_requests
  where user_id is not null
    and status = 'REQUESTED'
)
update public.demo_requests as request
   set status = 'REJECTED',
       resolution_note = coalesce(
         request.resolution_note,
         'Automatically closed as a duplicate pending request.'
       ),
       updated_at = now()
  from ranked_requests
 where request.id = ranked_requests.id
   and ranked_requests.request_rank > 1;

create unique index if not exists ux_demo_requests_pending_user
  on public.demo_requests (user_id)
  where user_id is not null and status = 'REQUESTED';

create or replace function public.create_demo_request_atomic(
  p_user_id uuid,
  p_email text,
  p_message text
)
returns table (
  request_id uuid,
  request_user_id uuid,
  request_email text,
  request_message text,
  request_status text,
  request_reviewed_by uuid,
  request_reviewed_at timestamptz,
  request_resolution_note text,
  request_approved_access_key_id uuid,
  request_created_at timestamptz,
  request_updated_at timestamptz,
  created boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.demo_requests%rowtype;
  v_created boolean := false;
begin
  if nullif(btrim(p_email), '') is null then
    raise exception 'Demo request email is required.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('demo-request:' || p_user_id::text, 0)
  );

  select *
    into v_request
    from public.demo_requests
   where user_id = p_user_id
     and status = 'REQUESTED'
   for update;

  if not found then
    insert into public.demo_requests (
      user_id,
      email,
      message,
      status
    )
    values (
      p_user_id,
      btrim(p_email),
      nullif(btrim(p_message), ''),
      'REQUESTED'
    )
    returning * into v_request;

    v_created := true;
  end if;

  return query
    select
      v_request.id,
      v_request.user_id,
      v_request.email,
      v_request.message,
      v_request.status,
      v_request.reviewed_by,
      v_request.reviewed_at,
      v_request.resolution_note,
      v_request.approved_access_key_id,
      v_request.created_at,
      v_request.updated_at,
      v_created;
end;
$$;

create or replace function public.resolve_demo_request_atomic(
  p_request_id uuid,
  p_decision text,
  p_reviewer_id uuid,
  p_access_key_id uuid,
  p_resolution_note text
)
returns table (
  request_id uuid,
  request_user_id uuid,
  request_email text,
  request_message text,
  request_status text,
  request_reviewed_by uuid,
  request_reviewed_at timestamptz,
  request_resolution_note text,
  request_approved_access_key_id uuid,
  request_created_at timestamptz,
  request_updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.demo_requests%rowtype;
begin
  if p_decision not in ('APPROVED', 'REJECTED') then
    raise exception 'Unsupported demo request decision.';
  end if;
  if p_decision = 'APPROVED' and p_access_key_id is null then
    raise exception 'Approved demo requests require an access key.';
  end if;

  select *
    into v_request
    from public.demo_requests
   where id = p_request_id
   for update;

  if not found then
    raise exception 'Demo request could not be found.';
  end if;
  if v_request.status <> 'REQUESTED' then
    raise exception 'This demo request has already been resolved.';
  end if;

  update public.demo_requests
     set status = p_decision,
         reviewed_by = p_reviewer_id,
         reviewed_at = now(),
         resolution_note = case
           when p_decision = 'REJECTED'
             then nullif(btrim(p_resolution_note), '')
           else null
         end,
         approved_access_key_id = case
           when p_decision = 'APPROVED' then p_access_key_id
           else null
         end,
         updated_at = now()
   where id = p_request_id
  returning * into v_request;

  return query
    select
      v_request.id,
      v_request.user_id,
      v_request.email,
      v_request.message,
      v_request.status,
      v_request.reviewed_by,
      v_request.reviewed_at,
      v_request.resolution_note,
      v_request.approved_access_key_id,
      v_request.created_at,
      v_request.updated_at;
end;
$$;

create or replace function public.activate_demo_access_atomic(
  p_brand_id uuid,
  p_plan_id uuid,
  p_user_id uuid,
  p_role text,
  p_invited_by uuid,
  p_expires_at timestamptz,
  p_idempotency_key text
)
returns table (
  membership_id uuid,
  membership_brand_id uuid,
  membership_user_id uuid,
  membership_role text,
  membership_status text,
  entitlement_id uuid,
  entitlement_brand_id uuid,
  entitlement_plan_id uuid,
  entitlement_source text,
  entitlement_status text,
  entitlement_starts_at timestamptz,
  entitlement_expires_at timestamptz,
  entitlement_granted_by uuid,
  entitlement_manual_reference text,
  entitlement_internal_note text,
  entitlement_created_at timestamptz,
  included_agent_keys text[],
  matched_agent_keys text[],
  agent_entitlement_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership public.brand_memberships%rowtype;
  v_grant record;
  v_starts_at timestamptz := now();
begin
  if p_role not in ('OWNER', 'EXECUTIVE_MANAGER', 'BRAND_SPECIALIST') then
    raise exception 'Unsupported demo membership role.';
  end if;
  if p_expires_at is not null and p_expires_at <= v_starts_at then
    raise exception 'Demo access has already expired.';
  end if;

  perform 1
    from public.brands
   where id = p_brand_id
   for update;
  if not found then
    raise exception 'Brand could not be found.';
  end if;

  insert into public.brand_memberships (
    brand_id,
    user_id,
    role,
    status,
    invited_by,
    expires_at
  )
  values (
    p_brand_id,
    p_user_id,
    p_role,
    'ACTIVE',
    p_invited_by,
    p_expires_at
  )
  on conflict (brand_id, user_id, role) do update
     set status = 'ACTIVE',
         invited_by = excluded.invited_by,
         expires_at = excluded.expires_at
  returning * into v_membership;

  select *
    into v_grant
    from public.grant_brand_access_atomic(
      p_brand_id,
      p_plan_id,
      'DEMO',
      v_starts_at,
      p_expires_at,
      p_user_id,
      'access_key:' || nullif(btrim(p_idempotency_key), ''),
      'Granted via DEMO_ACCESS key redemption',
      'demo_access_key:' || nullif(btrim(p_idempotency_key), '')
    );

  if v_grant.entitlement_id is null then
    raise exception 'Demo access grant could not be created.';
  end if;

  return query
    select
      v_membership.id,
      v_membership.brand_id,
      v_membership.user_id,
      v_membership.role,
      v_membership.status,
      v_grant.entitlement_id,
      v_grant.entitlement_brand_id,
      v_grant.entitlement_plan_id,
      v_grant.entitlement_source,
      v_grant.entitlement_status,
      v_grant.entitlement_starts_at,
      v_grant.entitlement_expires_at,
      v_grant.entitlement_granted_by,
      v_grant.entitlement_manual_reference,
      v_grant.entitlement_internal_note,
      v_grant.entitlement_created_at,
      v_grant.included_agent_keys,
      v_grant.matched_agent_keys,
      v_grant.agent_entitlement_count;
end;
$$;

create or replace function public.upsert_brand_agent_instruction_atomic(
  p_brand_id uuid,
  p_agent_id uuid,
  p_instruction text,
  p_is_enabled boolean,
  p_updated_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_setting_id uuid;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      'brand-agent-instruction:' ||
      p_brand_id::text ||
      ':' ||
      coalesce(p_agent_id::text, 'default'),
      0
    )
  );

  select id
    into v_setting_id
    from public.brand_agent_settings
   where brand_id = p_brand_id
     and coalesce(
       agent_id,
       '00000000-0000-0000-0000-000000000000'::uuid
     ) = coalesce(
       p_agent_id,
       '00000000-0000-0000-0000-000000000000'::uuid
     )
   for update;

  if v_setting_id is null then
    insert into public.brand_agent_settings (
      brand_id,
      agent_id,
      instruction,
      is_enabled,
      updated_by,
      updated_at
    )
    values (
      p_brand_id,
      p_agent_id,
      p_instruction,
      p_is_enabled,
      p_updated_by,
      now()
    )
    returning id into v_setting_id;
  else
    update public.brand_agent_settings
       set instruction = p_instruction,
           is_enabled = p_is_enabled,
           updated_by = p_updated_by,
           updated_at = now()
     where id = v_setting_id;
  end if;

  return v_setting_id;
end;
$$;

revoke all on function public.create_demo_request_atomic(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.create_demo_request_atomic(uuid, text, text)
  to service_role;

revoke all on function public.resolve_demo_request_atomic(
  uuid, text, uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.resolve_demo_request_atomic(
  uuid, text, uuid, uuid, text
) to service_role;

revoke all on function public.activate_demo_access_atomic(
  uuid, uuid, uuid, text, uuid, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.activate_demo_access_atomic(
  uuid, uuid, uuid, text, uuid, timestamptz, text
) to service_role;

revoke all on function public.upsert_brand_agent_instruction_atomic(
  uuid, uuid, text, boolean, uuid
) from public, anon, authenticated;
grant execute on function public.upsert_brand_agent_instruction_atomic(
  uuid, uuid, text, boolean, uuid
) to service_role;

notify pgrst, 'reload schema';
-- END 0035_release_race_hardening.sql

-- BEGIN 0036_atomic_brand_creation.sql
create or replace function public.create_brand_from_access_key_atomic(
  p_access_key_id uuid,
  p_brand_name text,
  p_industry text,
  p_website text,
  p_user_id uuid,
  p_user_email text
)
returns table (
  created_brand_id uuid,
  created_brand_name text,
  created_brand_industry text,
  created_brand_website text,
  created_brand_status text,
  created_membership_id uuid,
  created_intake_session_id uuid,
  used_access_key_id uuid,
  used_access_key_prefix text,
  used_plan_id uuid,
  created_module_types text[],
  created_module_count integer,
  entitlement_id uuid,
  entitlement_brand_id uuid,
  entitlement_plan_id uuid,
  entitlement_source text,
  entitlement_status text,
  entitlement_starts_at timestamptz,
  entitlement_expires_at timestamptz,
  entitlement_granted_by uuid,
  entitlement_manual_reference text,
  entitlement_internal_note text,
  entitlement_created_at timestamptz,
  included_agent_keys text[],
  matched_agent_keys text[],
  agent_entitlement_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_access_key public.access_keys%rowtype;
  v_plan public.plans%rowtype;
  v_brand public.brands%rowtype;
  v_membership_id uuid;
  v_intake_session_id uuid;
  v_module_types text[] := array[]::text[];
  v_now timestamptz := now();
  v_entitlement_id uuid;
  v_entitlement_brand_id uuid;
  v_entitlement_plan_id uuid;
  v_entitlement_source text;
  v_entitlement_status text;
  v_entitlement_starts_at timestamptz;
  v_entitlement_expires_at timestamptz;
  v_entitlement_granted_by uuid;
  v_entitlement_manual_reference text;
  v_entitlement_internal_note text;
  v_entitlement_created_at timestamptz;
  v_included_agent_keys text[] := array[]::text[];
  v_matched_agent_keys text[] := array[]::text[];
  v_agent_entitlement_count integer := 0;
begin
  if nullif(btrim(p_brand_name), '') is null
     or nullif(btrim(p_industry), '') is null then
    raise exception 'Brand name and industry are required.';
  end if;

  select *
    into v_access_key
    from public.access_keys
   where id = p_access_key_id
   for update;

  if not found
     or v_access_key.type <> 'CREATE_BRAND'
     or v_access_key.status <> 'REDEEMED'
     or v_access_key.redeemed_by is distinct from p_user_id then
    raise exception 'This access key cannot create a brand.';
  end if;
  if v_access_key.target_brand_id is not null then
    raise exception 'This CREATE_BRAND key has already been used.';
  end if;
  if v_access_key.expires_at <= v_now then
    raise exception 'This access key has expired.';
  end if;
  if v_access_key.target_email is not null
     and lower(btrim(v_access_key.target_email)) <>
       lower(btrim(p_user_email)) then
    raise exception 'This access key is assigned to another email address.';
  end if;

  if v_access_key.plan_id is not null then
    select *
      into v_plan
      from public.plans
     where id = v_access_key.plan_id
       and is_active = true
     for update;

    if not found then
      raise exception 'The plan attached to this access key is not active.';
    end if;

    select coalesce(
      array_agg(
        distinct btrim(entry.value #>> '{}')
        order by btrim(entry.value #>> '{}')
      ),
      array[]::text[]
    )
      into v_module_types
      from jsonb_array_elements(
        case
          when jsonb_typeof(v_plan.included_modules) = 'array'
            then v_plan.included_modules
          else '[]'::jsonb
        end
      ) as entry(value)
     where jsonb_typeof(entry.value) = 'string'
       and nullif(btrim(entry.value #>> '{}'), '') is not null;
  end if;

  insert into public.brands (
    name,
    industry,
    website,
    status,
    created_by
  )
  values (
    btrim(p_brand_name),
    btrim(p_industry),
    nullif(btrim(p_website), ''),
    'CREATED',
    p_user_id
  )
  returning * into v_brand;

  update public.access_keys
     set target_brand_id = v_brand.id
   where id = v_access_key.id;

  insert into public.brand_memberships (
    brand_id,
    user_id,
    role,
    status
  )
  values (
    v_brand.id,
    p_user_id,
    'OWNER',
    'ACTIVE'
  )
  returning id into v_membership_id;

  insert into public.intake_sessions (
    brand_id,
    status,
    completion_percent
  )
  values (
    v_brand.id,
    'DRAFT',
    0
  )
  returning id into v_intake_session_id;

  insert into public.brand_modules (
    brand_id,
    module_type,
    title,
    status
  )
  select
    v_brand.id,
    module_type,
    module_type,
    'NOT_STARTED'
  from unnest(v_module_types) as module_type;

  if v_access_key.plan_id is not null then
    select
      grant_result.entitlement_id,
      grant_result.entitlement_brand_id,
      grant_result.entitlement_plan_id,
      grant_result.entitlement_source,
      grant_result.entitlement_status,
      grant_result.entitlement_starts_at,
      grant_result.entitlement_expires_at,
      grant_result.entitlement_granted_by,
      grant_result.entitlement_manual_reference,
      grant_result.entitlement_internal_note,
      grant_result.entitlement_created_at,
      grant_result.included_agent_keys,
      grant_result.matched_agent_keys,
      grant_result.agent_entitlement_count
      into
        v_entitlement_id,
        v_entitlement_brand_id,
        v_entitlement_plan_id,
        v_entitlement_source,
        v_entitlement_status,
        v_entitlement_starts_at,
        v_entitlement_expires_at,
        v_entitlement_granted_by,
        v_entitlement_manual_reference,
        v_entitlement_internal_note,
        v_entitlement_created_at,
        v_included_agent_keys,
        v_matched_agent_keys,
        v_agent_entitlement_count
      from public.grant_brand_access_atomic(
        v_brand.id,
        v_plan.id,
        'ACCESS_KEY',
        v_now,
        case
          when v_plan.duration_days is not null
               and v_plan.duration_days > 0
            then v_now + make_interval(days => v_plan.duration_days)
          else null
        end,
        p_user_id,
        'access_key:' || v_access_key.id::text,
        null,
        'create_brand_access_key:' || v_access_key.id::text
      ) as grant_result;
  end if;

  return query
    select
      v_brand.id,
      v_brand.name,
      v_brand.industry,
      v_brand.website,
      v_brand.status,
      v_membership_id,
      v_intake_session_id,
      v_access_key.id,
      v_access_key.key_prefix,
      v_access_key.plan_id,
      v_module_types,
      cardinality(v_module_types),
      v_entitlement_id,
      v_entitlement_brand_id,
      v_entitlement_plan_id,
      v_entitlement_source,
      v_entitlement_status,
      v_entitlement_starts_at,
      v_entitlement_expires_at,
      v_entitlement_granted_by,
      v_entitlement_manual_reference,
      v_entitlement_internal_note,
      v_entitlement_created_at,
      v_included_agent_keys,
      v_matched_agent_keys,
      v_agent_entitlement_count;
end;
$$;

revoke all on function public.create_brand_from_access_key_atomic(
  uuid, text, text, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.create_brand_from_access_key_atomic(
  uuid, text, text, text, uuid, text
) to service_role;

notify pgrst, 'reload schema';
-- END 0036_atomic_brand_creation.sql

-- BEGIN 0037_atomic_intake_reordering.sql
create or replace function public.reorder_intake_section_atomic(
  p_section_id uuid,
  p_direction text
)
returns table (
  reordered_id uuid,
  target_id uuid,
  previous_order_index integer,
  current_order_index integer,
  changed boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids uuid[];
  v_current_position integer;
  v_target_position integer;
  v_target_id uuid;
  v_current_order integer;
  v_target_order integer;
begin
  if p_direction not in ('up', 'down') then
    raise exception 'Unsupported reorder direction.';
  end if;

  perform 1
    from public.question_sections
   where is_active = true
   order by order_index asc, created_at asc, id asc
   for update;

  select array_agg(id order by order_index asc, created_at asc, id asc)
    into v_ids
    from public.question_sections
   where is_active = true;

  v_current_position := array_position(v_ids, p_section_id);
  if v_current_position is null then
    raise exception 'Active section could not be found.';
  end if;

  v_target_position := case
    when p_direction = 'up' then v_current_position - 1
    else v_current_position + 1
  end;

  select order_index
    into v_current_order
    from public.question_sections
   where id = p_section_id;

  if v_target_position < 1
     or v_target_position > coalesce(array_length(v_ids, 1), 0) then
    return query
      select
        p_section_id,
        null::uuid,
        v_current_order,
        v_current_order,
        false;
    return;
  end if;

  v_target_id := v_ids[v_target_position];
  select order_index
    into v_target_order
    from public.question_sections
   where id = v_target_id;

  update public.question_sections
     set order_index = case
           when id = p_section_id then v_target_order
           else v_current_order
         end,
         updated_at = now()
   where id in (p_section_id, v_target_id);

  return query
    select
      p_section_id,
      v_target_id,
      v_current_order,
      v_target_order,
      true;
end;
$$;

create or replace function public.reorder_intake_question_atomic(
  p_question_id uuid,
  p_direction text
)
returns table (
  reordered_id uuid,
  target_id uuid,
  previous_order_index integer,
  current_order_index integer,
  changed boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_section_id uuid;
  v_ids uuid[];
  v_current_position integer;
  v_target_position integer;
  v_target_id uuid;
  v_current_order integer;
  v_target_order integer;
begin
  if p_direction not in ('up', 'down') then
    raise exception 'Unsupported reorder direction.';
  end if;

  select section_id
    into v_section_id
    from public.questions
   where id = p_question_id
     and is_active = true;

  if v_section_id is null then
    raise exception 'Active question could not be found.';
  end if;

  perform 1
    from public.questions
   where section_id = v_section_id
     and is_active = true
   order by order_index asc, created_at asc, id asc
   for update;

  select array_agg(id order by order_index asc, created_at asc, id asc)
    into v_ids
    from public.questions
   where section_id = v_section_id
     and is_active = true;

  v_current_position := array_position(v_ids, p_question_id);
  if v_current_position is null then
    raise exception 'Active question could not be found.';
  end if;

  v_target_position := case
    when p_direction = 'up' then v_current_position - 1
    else v_current_position + 1
  end;

  select order_index
    into v_current_order
    from public.questions
   where id = p_question_id;

  if v_target_position < 1
     or v_target_position > coalesce(array_length(v_ids, 1), 0) then
    return query
      select
        p_question_id,
        null::uuid,
        v_current_order,
        v_current_order,
        false;
    return;
  end if;

  v_target_id := v_ids[v_target_position];
  select order_index
    into v_target_order
    from public.questions
   where id = v_target_id;

  update public.questions
     set order_index = case
           when id = p_question_id then v_target_order
           else v_current_order
         end,
         updated_at = now()
   where id in (p_question_id, v_target_id);

  return query
    select
      p_question_id,
      v_target_id,
      v_current_order,
      v_target_order,
      true;
end;
$$;

revoke all on function public.reorder_intake_section_atomic(uuid, text)
  from public, anon, authenticated;
grant execute on function public.reorder_intake_section_atomic(uuid, text)
  to service_role;

revoke all on function public.reorder_intake_question_atomic(uuid, text)
  from public, anon, authenticated;
grant execute on function public.reorder_intake_question_atomic(uuid, text)
  to service_role;

notify pgrst, 'reload schema';
-- END 0037_atomic_intake_reordering.sql

-- BEGIN 0038_atomic_redeemed_brand_membership.sql
create or replace function public.activate_redeemed_brand_membership_atomic(
  p_access_key_id uuid,
  p_user_id uuid
)
returns table (
  brand_id uuid,
  brand_name text,
  brand_status text,
  membership_id uuid,
  membership_user_id uuid,
  membership_role text,
  membership_status text,
  membership_invited_by uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_access_key public.access_keys%rowtype;
  v_brand public.brands%rowtype;
  v_membership public.brand_memberships%rowtype;
  v_entitlement_id uuid;
  v_role text;
  v_invited_by uuid;
begin
  select *
    into v_access_key
    from public.access_keys
   where id = p_access_key_id
   for update;

  if not found
     or v_access_key.redeemed_by is distinct from p_user_id
     or v_access_key.redeemed_at is null
     or coalesce(v_access_key.redeemed_count, 0) < 1
     or v_access_key.status not in ('ACTIVE', 'REDEEMED') then
    raise exception 'The access key redemption could not be verified.';
  end if;

  if v_access_key.target_brand_id is null then
    raise exception 'The access key is missing a target brand.';
  end if;

  if v_access_key.type = 'CLAIM_BRAND'
     and v_access_key.target_role = 'OWNER' then
    v_role := 'OWNER';
    v_invited_by := null;
  elsif v_access_key.type = 'JOIN_BRAND'
        and v_access_key.target_role = 'BRAND_SPECIALIST' then
    v_role := 'BRAND_SPECIALIST';
    v_invited_by := v_access_key.created_by;
  else
    raise exception 'The access key cannot activate a brand membership.';
  end if;

  select *
    into v_brand
    from public.brands
   where id = v_access_key.target_brand_id
   for update;

  if not found then
    raise exception 'The target brand could not be found.';
  end if;

  select id
    into v_entitlement_id
    from public.brand_entitlements
   where brand_id = v_brand.id
     and status = 'ACTIVE'
     and starts_at <= now()
     and (expires_at is null or expires_at > now())
   order by starts_at desc, id
   limit 1
   for update;

  if v_entitlement_id is null then
    raise exception 'The brand workspace is not currently available.';
  end if;

  insert into public.brand_memberships (
    brand_id,
    user_id,
    role,
    status,
    invited_by,
    expires_at
  )
  values (
    v_brand.id,
    p_user_id,
    v_role,
    'ACTIVE',
    v_invited_by,
    null
  )
  on conflict (brand_id, user_id, role) do update
     set status = 'ACTIVE',
         invited_by = case
           when v_access_key.type = 'JOIN_BRAND'
             then excluded.invited_by
           else public.brand_memberships.invited_by
         end,
         expires_at = null
  returning * into v_membership;

  return query
    select
      v_brand.id,
      v_brand.name,
      v_brand.status,
      v_membership.id,
      v_membership.user_id,
      v_membership.role,
      v_membership.status,
      v_membership.invited_by;
end;
$$;

revoke all on function public.activate_redeemed_brand_membership_atomic(
  uuid,
  uuid
) from public, anon, authenticated;
grant execute on function public.activate_redeemed_brand_membership_atomic(
  uuid,
  uuid
) to service_role;

notify pgrst, 'reload schema';
-- END 0038_atomic_redeemed_brand_membership.sql

-- BEGIN 0039_rag_approval_consistency.sql
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
-- END 0039_rag_approval_consistency.sql

-- BEGIN 0040_city_model_district_files.sql
-- City Model district deliverables: one uploadable/approvable file per
-- (brand, district), mirroring the stakeholder/futures review-deliverable
-- pattern. Admin uploads a file for a district; the client views and approves.

create table if not exists public.city_model_district_files (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  district_key text not null,
  file_id uuid references public.files(id) on delete set null,
  status text not null default 'PENDING_UPLOAD',
  uploaded_by uuid references public.users_profile(id),
  uploaded_at timestamptz,
  approved_by uuid references public.users_profile(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, district_key)
);

create index if not exists city_model_district_files_brand_idx
  on public.city_model_district_files (brand_id);

-- Deny-by-default: all access is through the service-role admin client (no
-- policies), consistent with the other deliverable tables.
alter table public.city_model_district_files enable row level security;

-- Atomic: insert the file row + upsert the district deliverable in one txn,
-- returning the previous file id so its storage can be cleaned up.
create or replace function public.attach_city_model_district_file(
  p_brand_id uuid,
  p_district_key text,
  p_profile_id uuid,
  p_file_id uuid,
  p_storage_path text,
  p_original_name text,
  p_mime_type text,
  p_size_bytes bigint
)
returns table (deliverable_id uuid, old_file_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_old_file_id uuid;
  v_now timestamptz := now();
begin
  insert into public.city_model_district_files (brand_id, district_key, status)
  values (p_brand_id, p_district_key, 'PENDING_UPLOAD')
  on conflict (brand_id, district_key) do nothing;

  select id, file_id
    into v_id, v_old_file_id
    from public.city_model_district_files
   where brand_id = p_brand_id and district_key = p_district_key
   for update;

  insert into public.files (
    id, brand_id, storage_path, original_name,
    mime_type, size_bytes, visibility, status, uploaded_by
  )
  values (
    p_file_id, p_brand_id, p_storage_path, p_original_name,
    p_mime_type, p_size_bytes, 'CLIENT_REVIEW', 'CLIENT_REVIEW', p_profile_id
  );

  update public.city_model_district_files
     set file_id = p_file_id,
         status = 'CLIENT_REVIEW',
         uploaded_by = p_profile_id,
         uploaded_at = v_now,
         approved_by = null,
         approved_at = null,
         updated_at = v_now
   where id = v_id;

  return query select v_id, v_old_file_id;
end;
$$;
-- END 0040_city_model_district_files.sql

-- BEGIN 0041_unified_commenting.sql
-- Unified commenting & notifications.
--
-- Replaces the old PDF-coordinate annotation model with block-anchored comments
-- that work on any reviewable deliverable (stakeholder interviews, futures
-- research, city model districts, modules, brand-twin docs — everything except
-- the client-filled questionnaire). Comments anchor to a stable section slug
-- (`anchor_id`), not a pixel, so they survive re-render / RTL / re-export and
-- map 1:1 onto a RAG chunk.
--
-- Every comment raises a notification to the internal/admin team, deep-linked to
-- the exact section so they can apply requested changes.
--
-- Additive only: the old annotation tables are dropped in a later migration once
-- every surface has moved over.

-- Block-anchored, threaded comments attachable to ANY reviewable surface via a
-- polymorphic (subject_type, subject_id) key.
create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  -- which deliverable surface this comment lives on
  -- STAKEHOLDER_INTERVIEWS | FUTURES_RESEARCH | CITY_MODEL_DISTRICT | MODULE | BRAND_DOC
  subject_type text not null,
  -- report id / district key / module id — the surface's stable identifier
  subject_id text not null,
  -- threaded replies: root comments keep parent_id null
  parent_id uuid references public.review_comments(id) on delete cascade,
  -- stable block anchor (slug of the section heading); null = whole-document
  anchor_id text,
  -- human-readable heading captured at comment time, for re-anchoring + display
  anchor_label text,
  author_id uuid references public.users_profile(id),
  body text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists review_comments_subject_idx
  on public.review_comments (subject_type, subject_id);
create index if not exists review_comments_anchor_idx
  on public.review_comments (subject_type, subject_id, anchor_id);
create index if not exists review_comments_parent_idx
  on public.review_comments (parent_id);
create index if not exists review_comments_brand_idx
  on public.review_comments (brand_id);

-- In-app notifications. Every comment + review decision notifies the internal
-- team (and the client on decisions about their deliverables).
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete cascade,
  -- ADMIN | INTERNAL_TEAM | CLIENT — who should see it
  audience text not null,
  -- optional direct recipient; null = anyone in the audience for the brand
  recipient_id uuid references public.users_profile(id) on delete cascade,
  -- COMMENT_ADDED | COMMENT_REPLY | CHANGES_REQUESTED | APPROVED
  type text not null,
  title text not null,
  body text,
  -- deep link back to the exact section, e.g.
  -- /brand-integrated-brain/roadmap/city-model/purpose-form#anchor
  link_path text,
  subject_type text,
  subject_id text,
  comment_id uuid references public.review_comments(id) on delete cascade,
  actor_id uuid references public.users_profile(id),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, read_at);
create index if not exists notifications_brand_audience_idx
  on public.notifications (brand_id, audience, read_at);
create index if not exists notifications_subject_idx
  on public.notifications (subject_type, subject_id);

-- Deny-by-default RLS; all access is through the service-role admin client
-- behind app-level authorization, consistent with the rest of the schema.
alter table public.review_comments enable row level security;
alter table public.notifications enable row level security;

-- Atomic: insert a comment and fan out a notification to the internal team in
-- one txn, so a comment can never exist without its notification (or vice versa).
create or replace function public.add_review_comment(
  p_brand_id uuid,
  p_subject_type text,
  p_subject_id text,
  p_author_id uuid,
  p_body text,
  p_anchor_id text,
  p_anchor_label text,
  p_parent_id uuid,
  p_link_path text,
  p_notify_title text,
  p_notify_body text
)
returns table (comment_id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_comment_id uuid;
  v_created_at timestamptz;
  v_type text;
begin
  insert into public.review_comments (
    brand_id, subject_type, subject_id, parent_id,
    anchor_id, anchor_label, author_id, body
  )
  values (
    p_brand_id, p_subject_type, p_subject_id, p_parent_id,
    p_anchor_id, p_anchor_label, p_author_id, p_body
  )
  returning id, public.review_comments.created_at
    into v_comment_id, v_created_at;

  v_type := case when p_parent_id is null then 'COMMENT_ADDED'
                 else 'COMMENT_REPLY' end;

  insert into public.notifications (
    brand_id, audience, type, title, body,
    link_path, subject_type, subject_id, comment_id, actor_id
  )
  values (
    p_brand_id, 'INTERNAL_TEAM', v_type, p_notify_title, p_notify_body,
    p_link_path, p_subject_type, p_subject_id, v_comment_id, p_author_id
  );

  return query select v_comment_id, v_created_at;
end;
$$;
-- END 0041_unified_commenting.sql

-- BEGIN 0042_drop_pdf_annotations.sql
-- Remove the old PDF-coordinate annotation system. Block-anchored comments now
-- live in public.review_comments (migration 0041), which covers every
-- deliverable surface. The report/upload tables are unchanged — only the
-- coordinate-anchored annotation tables are dropped.

drop table if exists public.stakeholder_interview_annotations cascade;
drop table if exists public.futures_research_annotations cascade;
-- END 0042_drop_pdf_annotations.sql

-- BEGIN 0043_deliverable_markdown.sql
-- LLM-generated markdown cache for uploaded deliverables.
--
-- Admins upload a PDF; an automation extracts its text and uses the LLM to
-- restructure it into clean Markdown with proper headings. That markdown is
-- cached here (keyed by the source file) so the unified viewer renders it and
-- the RAG pipeline chunks it by heading — without re-running the LLM on every
-- page load. Images are not carried (PDF→text drops them); markdown is for the
-- text + heading structure that RAG and section-anchored comments need.

create table if not exists public.deliverable_markdown (
  file_id uuid primary key references public.files(id) on delete cascade,
  subject_type text,
  subject_id text,
  markdown text not null,
  -- PENDING | READY | FAILED — lets the UI show generation state
  status text not null default 'READY',
  error text,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deliverable_markdown_subject_idx
  on public.deliverable_markdown (subject_type, subject_id);

-- Deny-by-default RLS; all access via the service-role admin client.
alter table public.deliverable_markdown enable row level security;
-- END 0043_deliverable_markdown.sql

-- BEGIN 0044_review_comment_audience.sql
-- Directional comment notifications.
--
-- A comment notifies the OTHER party: a client comment notifies the internal
-- team; an internal-team reply notifies the brand's client reviewers (audience
-- CLIENT, scoped by brand_id). The audience is decided by the caller from the
-- author's role and passed in; it defaults to INTERNAL_TEAM so 11-argument
-- callers keep working.
--
-- The old fixed-audience signature is dropped first — keeping both would make
-- 11-argument calls ambiguous between the two overloads.

drop function if exists public.add_review_comment(
  uuid, text, text, uuid, text, text, text, uuid, text, text, text
);

create or replace function public.add_review_comment(
  p_brand_id uuid,
  p_subject_type text,
  p_subject_id text,
  p_author_id uuid,
  p_body text,
  p_anchor_id text,
  p_anchor_label text,
  p_parent_id uuid,
  p_link_path text,
  p_notify_title text,
  p_notify_body text,
  p_notify_audience text default 'INTERNAL_TEAM'
)
returns table (comment_id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_comment_id uuid;
  v_created_at timestamptz;
  v_type text;
begin
  insert into public.review_comments (
    brand_id, subject_type, subject_id, parent_id,
    anchor_id, anchor_label, author_id, body
  )
  values (
    p_brand_id, p_subject_type, p_subject_id, p_parent_id,
    p_anchor_id, p_anchor_label, p_author_id, p_body
  )
  returning id, public.review_comments.created_at
    into v_comment_id, v_created_at;

  v_type := case when p_parent_id is null then 'COMMENT_ADDED'
                 else 'COMMENT_REPLY' end;

  insert into public.notifications (
    brand_id, audience, type, title, body,
    link_path, subject_type, subject_id, comment_id, actor_id
  )
  values (
    p_brand_id, p_notify_audience, v_type, p_notify_title, p_notify_body,
    p_link_path, p_subject_type, p_subject_id, v_comment_id, p_author_id
  );

  return query select v_comment_id, v_created_at;
end;
$$;
-- END 0044_review_comment_audience.sql

-- BEGIN 0045_commenting_constraints.sql
-- Production-hardening for the commenting/notification tables (0041/0043):
-- CHECK constraints on the enum-like text columns so a code bug can never
-- write an unknown state, missing FK indexes for cascade targets and inbox
-- filters, and a guard that CLIENT-audience notifications always carry the
-- brand that scopes who may read them.

alter table public.review_comments
  add constraint review_comments_subject_type_check
  check (subject_type in (
    'STAKEHOLDER_INTERVIEWS',
    'FUTURES_RESEARCH',
    'CITY_MODEL_DISTRICT',
    'MODULE',
    'BRAND_DOC'
  ));

alter table public.notifications
  add constraint notifications_audience_check
  check (audience in ('ADMIN', 'INTERNAL_TEAM', 'CLIENT'));

-- A CLIENT notification without a brand would be readable by no one (the
-- client inbox filter is brand-scoped) — reject it at write time instead.
alter table public.notifications
  add constraint notifications_client_brand_check
  check (audience <> 'CLIENT' or brand_id is not null);

alter table public.deliverable_markdown
  add constraint deliverable_markdown_status_check
  check (status in ('PENDING', 'RAW', 'READY', 'FAILED'));

-- Cascade target: deleting a comment must not seq-scan notifications.
create index if not exists notifications_comment_idx
  on public.notifications (comment_id);

-- The inbox excludes the viewer's own activity (actor_id filter on every load).
create index if not exists notifications_actor_idx
  on public.notifications (actor_id);
-- END 0045_commenting_constraints.sql

-- BEGIN 0046_comment_highlights.sql
-- Inline text highlights for comments (Google-Docs-style).
--
-- A comment can now anchor to an exact text range *within* a block, not just to
-- the block as a whole. The range is stored as character offsets into the
-- block's rendered plain text (highlight_start/highlight_end) plus the quoted
-- text itself (highlight_text) — the quote is both shown in the sidebar and used
-- as a re-anchoring fallback if the offsets ever drift after a re-export.
--
-- All three columns are null for whole-document and section-level comments, so
-- this is fully backwards-compatible: existing comments keep working unchanged.

alter table public.review_comments
  add column if not exists highlight_start integer,
  add column if not exists highlight_end integer,
  add column if not exists highlight_text text;

-- A highlight is either fully present (start, end, text) or fully absent. Reject
-- partial/garbage ranges (negative, inverted) at write time.
alter table public.review_comments
  drop constraint if exists review_comments_highlight_check;
alter table public.review_comments
  add constraint review_comments_highlight_check
  check (
    (highlight_start is null and highlight_end is null and highlight_text is null)
    or (
      highlight_start is not null
      and highlight_end is not null
      and highlight_text is not null
      and highlight_start >= 0
      and highlight_end > highlight_start
    )
  );

-- Replace the insert RPC so the highlight range is written atomically with the
-- comment + notification. Mirrors 0044's signature plus the three highlight
-- params, which default to null so older callers keep working.
create or replace function public.add_review_comment(
  p_brand_id uuid,
  p_subject_type text,
  p_subject_id text,
  p_author_id uuid,
  p_body text,
  p_anchor_id text,
  p_anchor_label text,
  p_parent_id uuid,
  p_link_path text,
  p_notify_title text,
  p_notify_body text,
  p_notify_audience text default 'INTERNAL_TEAM',
  p_highlight_start integer default null,
  p_highlight_end integer default null,
  p_highlight_text text default null
)
returns table (comment_id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_comment_id uuid;
  v_created_at timestamptz;
  v_type text;
begin
  insert into public.review_comments (
    brand_id, subject_type, subject_id, parent_id,
    anchor_id, anchor_label, author_id, body,
    highlight_start, highlight_end, highlight_text
  )
  values (
    p_brand_id, p_subject_type, p_subject_id, p_parent_id,
    p_anchor_id, p_anchor_label, p_author_id, p_body,
    p_highlight_start, p_highlight_end, p_highlight_text
  )
  returning id, public.review_comments.created_at
    into v_comment_id, v_created_at;

  v_type := case when p_parent_id is null then 'COMMENT_ADDED'
                 else 'COMMENT_REPLY' end;

  insert into public.notifications (
    brand_id, audience, type, title, body,
    link_path, subject_type, subject_id, comment_id, actor_id
  )
  values (
    p_brand_id, p_notify_audience, v_type, p_notify_title, p_notify_body,
    p_link_path, p_subject_type, p_subject_id, v_comment_id, p_author_id
  );

  return query select v_comment_id, v_created_at;
end;
$$;
-- END 0046_comment_highlights.sql

-- Keep server-side Supabase access explicit after fresh schema creation.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines in schema public to service_role;

notify pgrst, 'reload schema';
