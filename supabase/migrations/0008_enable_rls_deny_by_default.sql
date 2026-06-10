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
