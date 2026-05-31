create or replace function public.autosave_intake_answer_fast(
  p_session_id uuid,
  p_question_id uuid,
  p_auth_user_id uuid,
  p_value jsonb
)
returns table (
  ok boolean,
  message text,
  question_id uuid,
  answer_id uuid,
  previous_value jsonb,
  value jsonb,
  input_type text,
  brand_id uuid,
  actor_profile_id uuid,
  actor_role text,
  completion_percent integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_session record;
  v_question record;
  v_has_access boolean;
  v_kind text;
  v_text text;
  v_normalized jsonb;
  v_stored_value jsonb;
  v_previous_value jsonb;
  v_answer_id uuid;
  v_answer_value jsonb;
  v_total_questions integer;
  v_answered_questions integer;
  v_completion_percent integer;
begin
  if p_session_id is null or p_question_id is null or p_auth_user_id is null then
    return query
      select false, 'The intake answer could not be saved.', null::uuid,
             null::uuid, null::jsonb, null::jsonb, null::text, null::uuid,
             null::uuid, null::text, null::integer;
    return;
  end if;

  select id, global_role
    into v_actor
    from public.users_profile
   where auth_user_id = p_auth_user_id;

  if not found then
    return query
      select false, 'The intake answer could not be saved.', null::uuid,
             null::uuid, null::jsonb, null::jsonb, null::text, null::uuid,
             null::uuid, null::text, null::integer;
    return;
  end if;

  select s.id, s.brand_id, s.status, s.locked_at
    into v_session
    from public.intake_sessions s
   where s.id = p_session_id;

  if not found then
    return query
      select false, 'The intake answer could not be saved.', null::uuid,
             null::uuid, null::jsonb, null::jsonb, null::text, null::uuid,
             v_actor.id, v_actor.global_role, null::integer;
    return;
  end if;

  if v_session.status = 'LOCKED' or v_session.locked_at is not null then
    return query
      select false, 'This intake session is locked and cannot be edited.',
             null::uuid, null::uuid, null::jsonb, null::jsonb, null::text,
             v_session.brand_id, v_actor.id, v_actor.global_role,
             null::integer;
    return;
  end if;

  select q.id, q.input_type
    into v_question
    from public.questions q
    join public.question_sections s on s.id = q.section_id
   where q.id = p_question_id
     and q.is_active = true
     and s.is_active = true;

  if not found then
    return query
      select false, 'The intake question could not be found.', null::uuid,
             null::uuid, null::jsonb, null::jsonb, null::text,
             v_session.brand_id, v_actor.id, v_actor.global_role,
             null::integer;
    return;
  end if;

  select (
    exists (
      select 1
       where v_actor.global_role = 'PLATFORM_OWNER'
    )
    or exists (
      select 1
        from public.brand_memberships m
        join public.brand_entitlements e on e.brand_id = m.brand_id
       where m.user_id = v_actor.id
         and m.brand_id = v_session.brand_id
         and m.status = 'ACTIVE'
         and m.role in ('OWNER', 'EXECUTIVE_MANAGER')
         and e.status = 'ACTIVE'
         and (e.starts_at is null or e.starts_at <= now())
         and (e.expires_at is null or e.expires_at > now())
    )
  )
  into v_has_access;

  if not v_has_access then
    return query
      select false, 'You do not have permission to answer this intake.',
             null::uuid, null::uuid, null::jsonb, null::jsonb, null::text,
             v_session.brand_id, v_actor.id, v_actor.global_role,
             null::integer;
    return;
  end if;

  v_kind := lower(trim(v_question.input_type));

  if v_kind in ('checkbox', 'boolean') then
    if jsonb_typeof(p_value) = 'boolean' then
      v_normalized := p_value;
    elsif jsonb_typeof(p_value) = 'string' then
      v_normalized := to_jsonb(lower(trim(p_value #>> '{}')) in ('1', 'true', 'yes', 'on'));
    else
      v_normalized := 'false'::jsonb;
    end if;
  elsif v_kind in (
    'multi_select',
    'multi-select',
    'multiselect',
    'checkbox_group',
    'checkbox-group'
  ) then
    if jsonb_typeof(p_value) = 'array' then
      select coalesce(jsonb_agg(item order by item), '[]'::jsonb)
        into v_normalized
        from (
          select distinct trim(raw_item) as item
            from jsonb_array_elements_text(p_value) as raw_items(raw_item)
           where trim(raw_item) <> ''
        ) normalized_items;
    elsif jsonb_typeof(p_value) = 'string' and trim(p_value #>> '{}') <> '' then
      v_normalized := jsonb_build_array(trim(p_value #>> '{}'));
    else
      v_normalized := '[]'::jsonb;
    end if;
  elsif v_kind in ('number', 'numeric') then
    v_text := trim(coalesce(p_value #>> '{}', ''));

    if p_value is null or p_value = 'null'::jsonb or v_text = '' then
      v_normalized := 'null'::jsonb;
    elsif jsonb_typeof(p_value) = 'number' then
      v_normalized := p_value;
    elsif v_text ~ '^-?((\d+(\.\d*)?)|(\.\d+))([eE][+-]?\d+)?$' then
      v_normalized := to_jsonb(v_text::numeric);
    else
      v_normalized := 'null'::jsonb;
    end if;
  else
    if jsonb_typeof(p_value) = 'string' then
      v_text := trim(p_value #>> '{}');
    else
      v_text := '';
    end if;

    if v_text = '' then
      v_normalized := 'null'::jsonb;
    else
      v_normalized := to_jsonb(v_text);
    end if;
  end if;

  v_stored_value := jsonb_build_object('value', v_normalized);

  select a.value
    into v_previous_value
    from public.intake_answers a
   where a.session_id = p_session_id
     and a.question_id = p_question_id;

  insert into public.intake_answers (
    session_id,
    question_id,
    value,
    updated_by,
    updated_at
  )
  values (
    p_session_id,
    p_question_id,
    v_stored_value,
    v_actor.id,
    now()
  )
  on conflict (session_id, question_id)
  do update
     set value = excluded.value,
         updated_by = excluded.updated_by,
         updated_at = excluded.updated_at
  returning id, value
  into v_answer_id, v_answer_value;

  select
    count(*),
    count(*) filter (
      where a.value ? 'value'
        and case jsonb_typeof(a.value -> 'value')
          when 'array' then jsonb_array_length(a.value -> 'value') > 0
          when 'string' then trim(a.value ->> 'value') <> ''
          when 'number' then true
          when 'boolean' then true
          else false
        end
    )
    into v_total_questions, v_answered_questions
    from public.question_sections s
    join public.questions q on q.section_id = s.id
    left join public.intake_answers a
      on a.session_id = p_session_id
     and a.question_id = q.id
   where s.is_active = true
     and q.is_active = true;

  if v_total_questions > 0 then
    v_completion_percent :=
      round((v_answered_questions::numeric / v_total_questions::numeric) * 100)::integer;
  else
    v_completion_percent := 0;
  end if;

  update public.intake_sessions
     set completion_percent = v_completion_percent,
         updated_at = now()
   where id = p_session_id;

  return query
    select true, null::text, p_question_id, v_answer_id, v_previous_value,
           v_answer_value, v_question.input_type, v_session.brand_id,
           v_actor.id, v_actor.global_role, v_completion_percent;
end;
$$;

revoke all on function public.autosave_intake_answer_fast(uuid, uuid, uuid, jsonb)
from public, anon, authenticated;

grant execute on function public.autosave_intake_answer_fast(uuid, uuid, uuid, jsonb)
to service_role;

notify pgrst, 'reload schema';
