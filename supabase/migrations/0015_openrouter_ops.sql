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
