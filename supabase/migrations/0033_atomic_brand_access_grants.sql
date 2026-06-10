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
