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
