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
