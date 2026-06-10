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
