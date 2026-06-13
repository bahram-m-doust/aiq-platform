-- Inline text highlights for comments (Google-Docs-style).
--
-- A comment can now anchor to an exact text range *within* a block, not just to
-- the block as a whole. The range is stored as character offsets into the
-- block's rendered plain text (highlight_start/highlight_end) plus the quoted
-- text itself (highlight_text) — the quote is both shown in the sidebar and used
-- as a re-anchoring fallback if the offsets ever drift after a re-export.
--
-- All three columns are null for whole-document and section-level comments, so
-- this is fully backwards-compatible: existing comments keep working unchanged.

alter table public.review_comments
  add column if not exists highlight_start integer,
  add column if not exists highlight_end integer,
  add column if not exists highlight_text text;

-- A highlight is either fully present (start, end, text) or fully absent. Reject
-- partial/garbage ranges (negative, inverted) at write time.
alter table public.review_comments
  drop constraint if exists review_comments_highlight_check;
alter table public.review_comments
  add constraint review_comments_highlight_check
  check (
    (highlight_start is null and highlight_end is null and highlight_text is null)
    or (
      highlight_start is not null
      and highlight_end is not null
      and highlight_text is not null
      and highlight_start >= 0
      and highlight_end > highlight_start
    )
  );

-- Replace the insert RPC so the highlight range is written atomically with the
-- comment + notification. Mirrors 0044's signature plus the three highlight
-- params, which default to null so older callers keep working.
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
  p_notify_audience text default 'INTERNAL_TEAM',
  p_highlight_start integer default null,
  p_highlight_end integer default null,
  p_highlight_text text default null
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
    anchor_id, anchor_label, author_id, body,
    highlight_start, highlight_end, highlight_text
  )
  values (
    p_brand_id, p_subject_type, p_subject_id, p_parent_id,
    p_anchor_id, p_anchor_label, p_author_id, p_body,
    p_highlight_start, p_highlight_end, p_highlight_text
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
