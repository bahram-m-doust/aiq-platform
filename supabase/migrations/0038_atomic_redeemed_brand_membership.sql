create or replace function public.activate_redeemed_brand_membership_atomic(
  p_access_key_id uuid,
  p_user_id uuid
)
returns table (
  brand_id uuid,
  brand_name text,
  brand_status text,
  membership_id uuid,
  membership_user_id uuid,
  membership_role text,
  membership_status text,
  membership_invited_by uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_access_key public.access_keys%rowtype;
  v_brand public.brands%rowtype;
  v_membership public.brand_memberships%rowtype;
  v_entitlement_id uuid;
  v_role text;
  v_invited_by uuid;
begin
  select *
    into v_access_key
    from public.access_keys
   where id = p_access_key_id
   for update;

  if not found
     or v_access_key.redeemed_by is distinct from p_user_id
     or v_access_key.redeemed_at is null
     or coalesce(v_access_key.redeemed_count, 0) < 1
     or v_access_key.status not in ('ACTIVE', 'REDEEMED') then
    raise exception 'The access key redemption could not be verified.';
  end if;

  if v_access_key.target_brand_id is null then
    raise exception 'The access key is missing a target brand.';
  end if;

  if v_access_key.type = 'CLAIM_BRAND'
     and v_access_key.target_role = 'OWNER' then
    v_role := 'OWNER';
    v_invited_by := null;
  elsif v_access_key.type = 'JOIN_BRAND'
        and v_access_key.target_role = 'BRAND_SPECIALIST' then
    v_role := 'BRAND_SPECIALIST';
    v_invited_by := v_access_key.created_by;
  else
    raise exception 'The access key cannot activate a brand membership.';
  end if;

  select *
    into v_brand
    from public.brands
   where id = v_access_key.target_brand_id
   for update;

  if not found then
    raise exception 'The target brand could not be found.';
  end if;

  select id
    into v_entitlement_id
    from public.brand_entitlements
   where brand_id = v_brand.id
     and status = 'ACTIVE'
     and starts_at <= now()
     and (expires_at is null or expires_at > now())
   order by starts_at desc, id
   limit 1
   for update;

  if v_entitlement_id is null then
    raise exception 'The brand workspace is not currently available.';
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
    v_brand.id,
    p_user_id,
    v_role,
    'ACTIVE',
    v_invited_by,
    null
  )
  on conflict (brand_id, user_id, role) do update
     set status = 'ACTIVE',
         invited_by = case
           when v_access_key.type = 'JOIN_BRAND'
             then excluded.invited_by
           else public.brand_memberships.invited_by
         end,
         expires_at = null
  returning * into v_membership;

  return query
    select
      v_brand.id,
      v_brand.name,
      v_brand.status,
      v_membership.id,
      v_membership.user_id,
      v_membership.role,
      v_membership.status,
      v_membership.invited_by;
end;
$$;

revoke all on function public.activate_redeemed_brand_membership_atomic(
  uuid,
  uuid
) from public, anon, authenticated;
grant execute on function public.activate_redeemed_brand_membership_atomic(
  uuid,
  uuid
) to service_role;

notify pgrst, 'reload schema';
