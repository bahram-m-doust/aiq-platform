-- Brain Build scheduling.
--
-- Once a brand's Aesthetics are approved, Phase 04 (Brain Build) is handed to
-- the Bextudio team. An admin sets a target_date, which drives the animated
-- progress bar shown to the brand. When the team runs "Build Now" the brain is
-- assembled (RAG sync + agent activation) and built_at is stamped — that's the
-- signal the brand-facing roadmap uses to unlock the Brand Brain chatbot.
--
-- One row per brand (upsert on brand_id). Service-role only; all reads happen
-- through the admin client in server components, consistent with the rest of
-- the platform's deny-by-default RLS posture.
create table if not exists public.brain_build_schedule (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null unique references public.brands(id) on delete cascade,
  -- the date the brand is told its brain will be ready (drives the progress bar)
  target_date  date not null,
  scheduled_by uuid references public.users_profile(id),
  -- null until the team runs "Build Now"; once stamped the chatbot unlocks
  built_at     timestamptz,
  built_by     uuid references public.users_profile(id),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists brain_build_schedule_brand_idx
  on public.brain_build_schedule (brand_id);

alter table public.brain_build_schedule enable row level security;
-- No policies: deny-by-default. Access is mediated by the service-role admin
-- client with app-level authorization, like every other platform table.

notify pgrst, 'reload schema';
