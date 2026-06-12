-- Directional comment notifications.
--
-- A comment notifies the OTHER party: a client comment notifies the internal
-- team; an internal-team reply notifies the brand's client reviewers (audience
-- CLIENT, scoped by brand_id). The audience is decided by the caller from the
-- author's role and passed in; it defaults to INTERNAL_TEAM so 11-argument
-- callers keep working.
--
-- The old fixed-audience signature is dropped first — keeping both would make
-- 11-argument calls ambiguous between the two overloads.

drop function if exists public.add_review_comment(
  uuid, text, text, uuid, text, text, text, uuid, text, text, text
);

create or replace function public.add_review_comment(
  p_brand_id uuid,
  p_subject_type text,
  p_subject_id text,
  p_author_id uuid,
  p_body text,
  p_anchor_id text,
  p_anchor_label text,
  p_parent_id uuid,
  p_link_path text,
  p_notify_title text,
  p_notify_body text,
  p_notify_audience text default 'INTERNAL_TEAM'
)
returns table (comment_id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_comment_id uuid;
  v_created_at timestamptz;
  v_type text;
begin
  insert into public.review_comments (
    brand_id, subject_type, subject_id, parent_id,
    anchor_id, anchor_label, author_id, body
  )
  values (
    p_brand_id, p_subject_type, p_subject_id, p_parent_id,
    p_anchor_id, p_anchor_label, p_author_id, p_body
  )
  returning id, public.review_comments.created_at
    into v_comment_id, v_created_at;

  v_type := case when p_parent_id is null then 'COMMENT_ADDED'
                 else 'COMMENT_REPLY' end;

  insert into public.notifications (
    brand_id, audience, type, title, body,
    link_path, subject_type, subject_id, comment_id, actor_id
  )
  values (
    p_brand_id, p_notify_audience, v_type, p_notify_title, p_notify_body,
    p_link_path, p_subject_type, p_subject_id, v_comment_id, p_author_id
  );

  return query select v_comment_id, v_created_at;
end;
$$;
