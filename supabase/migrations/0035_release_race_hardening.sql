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
