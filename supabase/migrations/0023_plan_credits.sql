-- 0023_plan_credits.sql
-- Adds a per-plan credit allowance. Each brand inherits the credits of its
-- active plan; the value is surfaced in the dashboard sidebar footer.

alter table public.plans
  add column if not exists credits integer not null default 0;

comment on column public.plans.credits is
  'Credit allowance granted to brands on this plan. Surfaced in the dashboard sidebar.';

-- Reload PostgREST so the new column is selectable immediately.
notify pgrst, 'reload schema';
