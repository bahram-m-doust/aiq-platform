create or replace function public.transition_module_review(
  p_action text,
  p_module_id uuid,
  p_brand_id uuid,
  p_artifact_id uuid,
  p_file_id uuid,
  p_reviewer_id uuid,
  p_comment text
)
returns table (
  id uuid,
  module_id uuid,
  reviewer_id uuid,
  review_type text,
  decision text,
  comment text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_module_status text;
  v_artifact_status text;
  v_artifact_type text;
  v_file_status text;
begin
  select status
    into v_module_status
    from public.brand_modules
   where public.brand_modules.id = p_module_id
     and brand_id = p_brand_id
   for update;

  select ma.status, ma.artifact_type, f.status
    into v_artifact_status, v_artifact_type, v_file_status
    from public.module_artifacts ma
    join public.files f on f.id = ma.file_id
   where ma.id = p_artifact_id
     and ma.module_id = p_module_id
     and f.id = p_file_id
     and f.brand_id = p_brand_id
   for update of ma, f;

  if v_module_status is null or v_artifact_status is null then
    raise exception 'Module review resources were not found.';
  end if;

  if p_action = 'SEND_TO_CLIENT' then
    if v_artifact_type <> 'PDF'
       or v_artifact_status not in ('INTERNAL_DRAFT', 'SUPERVISOR_APPROVED') then
      raise exception 'A reviewable PDF artifact is required.';
    end if;

    update public.brand_modules
       set status = 'CLIENT_REVIEW', updated_at = now()
     where public.brand_modules.id = p_module_id;
    update public.module_artifacts
       set status = 'CLIENT_REVIEW'
     where public.module_artifacts.id = p_artifact_id;
    update public.files
       set visibility = 'CLIENT_REVIEW', status = 'CLIENT_REVIEW'
     where public.files.id = p_file_id;

    return query
      insert into public.module_reviews (
        module_id, reviewer_id, review_type, decision, comment
      )
      values (
        p_module_id, p_reviewer_id, 'SUPERVISOR',
        'APPROVED_FOR_CLIENT_REVIEW', null
      )
      returning
        module_reviews.id,
        module_reviews.module_id,
        module_reviews.reviewer_id,
        module_reviews.review_type,
        module_reviews.decision,
        module_reviews.comment,
        module_reviews.created_at;
  elsif p_action = 'CLIENT_APPROVE' then
    if v_module_status <> 'CLIENT_REVIEW'
       or v_artifact_status <> 'CLIENT_REVIEW'
       or v_file_status <> 'CLIENT_REVIEW' then
      raise exception 'Module is not in client review.';
    end if;

    update public.brand_modules
       set status = 'CLIENT_APPROVED', updated_at = now()
     where public.brand_modules.id = p_module_id;
    update public.module_artifacts
       set status = 'CLIENT_APPROVED'
     where public.module_artifacts.id = p_artifact_id;
    update public.files
       set status = 'CLIENT_APPROVED'
     where public.files.id = p_file_id;

    return query
      insert into public.module_reviews (
        module_id, reviewer_id, review_type, decision, comment
      )
      values (
        p_module_id, p_reviewer_id, 'CLIENT', 'APPROVED', p_comment
      )
      returning
        module_reviews.id,
        module_reviews.module_id,
        module_reviews.reviewer_id,
        module_reviews.review_type,
        module_reviews.decision,
        module_reviews.comment,
        module_reviews.created_at;
  elsif p_action = 'CLIENT_REQUEST_CHANGE' then
    if v_module_status <> 'CLIENT_REVIEW'
       or v_artifact_status <> 'CLIENT_REVIEW'
       or v_file_status <> 'CLIENT_REVIEW'
       or nullif(btrim(p_comment), '') is null then
      raise exception 'A client-review module and comment are required.';
    end if;

    update public.brand_modules
       set status = 'CLIENT_CHANGE_REQUESTED', updated_at = now()
     where public.brand_modules.id = p_module_id;

    return query
      insert into public.module_reviews (
        module_id, reviewer_id, review_type, decision, comment
      )
      values (
        p_module_id, p_reviewer_id, 'CLIENT', 'CHANGE_REQUESTED', p_comment
      )
      returning
        module_reviews.id,
        module_reviews.module_id,
        module_reviews.reviewer_id,
        module_reviews.review_type,
        module_reviews.decision,
        module_reviews.comment,
        module_reviews.created_at;
  else
    raise exception 'Unsupported module review action.';
  end if;
end;
$$;

revoke all on function public.transition_module_review(
  text, uuid, uuid, uuid, uuid, uuid, text
) from public, anon, authenticated;

grant execute on function public.transition_module_review(
  text, uuid, uuid, uuid, uuid, uuid, text
) to service_role;

notify pgrst, 'reload schema';
