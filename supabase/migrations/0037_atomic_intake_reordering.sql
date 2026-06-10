create or replace function public.reorder_intake_section_atomic(
  p_section_id uuid,
  p_direction text
)
returns table (
  reordered_id uuid,
  target_id uuid,
  previous_order_index integer,
  current_order_index integer,
  changed boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids uuid[];
  v_current_position integer;
  v_target_position integer;
  v_target_id uuid;
  v_current_order integer;
  v_target_order integer;
begin
  if p_direction not in ('up', 'down') then
    raise exception 'Unsupported reorder direction.';
  end if;

  perform 1
    from public.question_sections
   where is_active = true
   order by order_index asc, created_at asc, id asc
   for update;

  select array_agg(id order by order_index asc, created_at asc, id asc)
    into v_ids
    from public.question_sections
   where is_active = true;

  v_current_position := array_position(v_ids, p_section_id);
  if v_current_position is null then
    raise exception 'Active section could not be found.';
  end if;

  v_target_position := case
    when p_direction = 'up' then v_current_position - 1
    else v_current_position + 1
  end;

  select order_index
    into v_current_order
    from public.question_sections
   where id = p_section_id;

  if v_target_position < 1
     or v_target_position > coalesce(array_length(v_ids, 1), 0) then
    return query
      select
        p_section_id,
        null::uuid,
        v_current_order,
        v_current_order,
        false;
    return;
  end if;

  v_target_id := v_ids[v_target_position];
  select order_index
    into v_target_order
    from public.question_sections
   where id = v_target_id;

  update public.question_sections
     set order_index = case
           when id = p_section_id then v_target_order
           else v_current_order
         end,
         updated_at = now()
   where id in (p_section_id, v_target_id);

  return query
    select
      p_section_id,
      v_target_id,
      v_current_order,
      v_target_order,
      true;
end;
$$;

create or replace function public.reorder_intake_question_atomic(
  p_question_id uuid,
  p_direction text
)
returns table (
  reordered_id uuid,
  target_id uuid,
  previous_order_index integer,
  current_order_index integer,
  changed boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_section_id uuid;
  v_ids uuid[];
  v_current_position integer;
  v_target_position integer;
  v_target_id uuid;
  v_current_order integer;
  v_target_order integer;
begin
  if p_direction not in ('up', 'down') then
    raise exception 'Unsupported reorder direction.';
  end if;

  select section_id
    into v_section_id
    from public.questions
   where id = p_question_id
     and is_active = true;

  if v_section_id is null then
    raise exception 'Active question could not be found.';
  end if;

  perform 1
    from public.questions
   where section_id = v_section_id
     and is_active = true
   order by order_index asc, created_at asc, id asc
   for update;

  select array_agg(id order by order_index asc, created_at asc, id asc)
    into v_ids
    from public.questions
   where section_id = v_section_id
     and is_active = true;

  v_current_position := array_position(v_ids, p_question_id);
  if v_current_position is null then
    raise exception 'Active question could not be found.';
  end if;

  v_target_position := case
    when p_direction = 'up' then v_current_position - 1
    else v_current_position + 1
  end;

  select order_index
    into v_current_order
    from public.questions
   where id = p_question_id;

  if v_target_position < 1
     or v_target_position > coalesce(array_length(v_ids, 1), 0) then
    return query
      select
        p_question_id,
        null::uuid,
        v_current_order,
        v_current_order,
        false;
    return;
  end if;

  v_target_id := v_ids[v_target_position];
  select order_index
    into v_target_order
    from public.questions
   where id = v_target_id;

  update public.questions
     set order_index = case
           when id = p_question_id then v_target_order
           else v_current_order
         end,
         updated_at = now()
   where id in (p_question_id, v_target_id);

  return query
    select
      p_question_id,
      v_target_id,
      v_current_order,
      v_target_order,
      true;
end;
$$;

revoke all on function public.reorder_intake_section_atomic(uuid, text)
  from public, anon, authenticated;
grant execute on function public.reorder_intake_section_atomic(uuid, text)
  to service_role;

revoke all on function public.reorder_intake_question_atomic(uuid, text)
  from public, anon, authenticated;
grant execute on function public.reorder_intake_question_atomic(uuid, text)
  to service_role;

notify pgrst, 'reload schema';
