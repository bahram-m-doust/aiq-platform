create or replace function public.autosave_intake_answers_batch(
  p_session_id uuid,
  p_auth_user_id uuid,
  p_answers jsonb
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
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_session record;
  v_has_access boolean;
  v_item jsonb;
  v_ord integer;
  v_question_id_text text;
  v_question_id uuid;
  v_input_count integer;
  v_upsert record;
  v_total_questions integer;
  v_answered_questions integer;
  v_completion_percent integer;
begin
  if p_session_id is null or p_auth_user_id is null then
    return query
      select false, 'The intake answer could not be saved.', null::uuid,
             null::uuid, null::jsonb, null::jsonb, null::text, null::uuid,
             null::uuid, null::text, null::integer;
    return;
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    return query
      select false, 'The intake answer could not be saved.', null::uuid,
             null::uuid, null::jsonb, null::jsonb, null::text, null::uuid,
             null::uuid, null::text, null::integer;
    return;
  end if;

  select p.id, p.global_role
    into v_actor
    from public.users_profile p
   where p.auth_user_id = p_auth_user_id;

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

  create temporary table if not exists pg_temp.autosave_intake_batch_input (
    ord integer not null,
    question_id uuid,
    raw_value jsonb,
    input_type text,
    normalized_value jsonb,
    stored_value jsonb,
    previous_value jsonb,
    answer_id uuid,
    answer_value jsonb
  ) on commit drop;

  truncate table pg_temp.autosave_intake_batch_input;

  for v_item, v_ord in
    select items.value, items.ordinality::integer
      from jsonb_array_elements(p_answers) with ordinality as items(value, ordinality)
  loop
    v_question_id_text := coalesce(
      nullif(trim(v_item ->> 'question_id'), ''),
      nullif(trim(v_item ->> 'questionId'), '')
    );
    v_question_id := null;

    if v_question_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_question_id := v_question_id_text::uuid;
    end if;

    insert into pg_temp.autosave_intake_batch_input (
      ord,
      question_id,
      raw_value
    )
    values (
      v_ord,
      v_question_id,
      coalesce(v_item -> 'value', 'null'::jsonb)
    );
  end loop;

  delete from pg_temp.autosave_intake_batch_input older
  using pg_temp.autosave_intake_batch_input newer
  where older.question_id = newer.question_id
    and older.ord < newer.ord;

  select count(*)
    into v_input_count
    from pg_temp.autosave_intake_batch_input;

  if v_input_count = 0 or exists (
    select 1 from pg_temp.autosave_intake_batch_input where question_id is null
  ) then
    return query
      select false, 'The intake answer could not be saved.', null::uuid,
             null::uuid, null::jsonb, null::jsonb, null::text,
             v_session.brand_id, v_actor.id, v_actor.global_role,
             null::integer;
    return;
  end if;

  update pg_temp.autosave_intake_batch_input i
     set input_type = q.input_type
    from public.questions q
    join public.question_sections s on s.id = q.section_id
   where i.question_id = q.id
     and q.is_active = true
     and s.is_active = true;

  if exists (
    select 1 from pg_temp.autosave_intake_batch_input where input_type is null
  ) then
    return query
      select false, 'The intake question could not be found.', null::uuid,
             null::uuid, null::jsonb, null::jsonb, null::text,
             v_session.brand_id, v_actor.id, v_actor.global_role,
             null::integer;
    return;
  end if;

  update pg_temp.autosave_intake_batch_input i
     set normalized_value =
       case
         when lower(trim(i.input_type)) in ('checkbox', 'boolean') then
           case
             when jsonb_typeof(i.raw_value) = 'boolean' then i.raw_value
             when jsonb_typeof(i.raw_value) = 'string' then
               to_jsonb(lower(trim(i.raw_value #>> '{}')) in ('1', 'true', 'yes', 'on'))
             else 'false'::jsonb
           end
         when lower(trim(i.input_type)) in (
           'multi_select',
           'multi-select',
           'multiselect',
           'checkbox_group',
           'checkbox-group'
         ) then
           case
             when jsonb_typeof(i.raw_value) = 'array' then (
               select coalesce(jsonb_agg(item order by item), '[]'::jsonb)
                 from (
                   select distinct trim(raw_item) as item
                     from jsonb_array_elements_text(i.raw_value) as raw_items(raw_item)
                    where trim(raw_item) <> ''
                 ) normalized_items
             )
             when jsonb_typeof(i.raw_value) = 'string'
              and trim(i.raw_value #>> '{}') <> '' then
               jsonb_build_array(trim(i.raw_value #>> '{}'))
             else '[]'::jsonb
           end
         when lower(trim(i.input_type)) in ('number', 'numeric') then
           case
             when i.raw_value is null
               or i.raw_value = 'null'::jsonb
               or trim(coalesce(i.raw_value #>> '{}', '')) = '' then
               'null'::jsonb
             when jsonb_typeof(i.raw_value) = 'number' then i.raw_value
             when trim(i.raw_value #>> '{}') ~ '^-?((\d+(\.\d*)?)|(\.\d+))([eE][+-]?\d+)?$' then
               to_jsonb((trim(i.raw_value #>> '{}'))::numeric)
             else 'null'::jsonb
           end
         else
           case
             when jsonb_typeof(i.raw_value) = 'string'
              and trim(i.raw_value #>> '{}') <> '' then
               to_jsonb(trim(i.raw_value #>> '{}'))
             else 'null'::jsonb
           end
       end;

  update pg_temp.autosave_intake_batch_input
     set stored_value = jsonb_build_object('value', normalized_value);

  update pg_temp.autosave_intake_batch_input i
     set previous_value = a.value
    from public.intake_answers a
   where a.session_id = p_session_id
     and a.question_id = i.question_id;

  for v_upsert in
    insert into public.intake_answers (
      session_id,
      question_id,
      value,
      updated_by,
      updated_at
    )
    select
      p_session_id,
      i.question_id,
      i.stored_value,
      v_actor.id,
      now()
    from pg_temp.autosave_intake_batch_input i
    order by i.ord
    on conflict (session_id, question_id)
    do update
       set value = excluded.value,
           updated_by = excluded.updated_by,
           updated_at = excluded.updated_at
    returning question_id, id, value
  loop
    update pg_temp.autosave_intake_batch_input i
       set answer_id = v_upsert.id,
           answer_value = v_upsert.value
     where i.question_id = v_upsert.question_id;
  end loop;

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
    select true, null::text, i.question_id, i.answer_id, i.previous_value,
           i.answer_value, i.input_type, v_session.brand_id, v_actor.id,
           v_actor.global_role, v_completion_percent
      from pg_temp.autosave_intake_batch_input i
     order by i.ord;
end;
$$;

revoke all on function public.autosave_intake_answers_batch(uuid, uuid, jsonb)
from public, anon, authenticated;

grant execute on function public.autosave_intake_answers_batch(uuid, uuid, jsonb)
to service_role;

notify pgrst, 'reload schema';
