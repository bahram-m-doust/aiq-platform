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
