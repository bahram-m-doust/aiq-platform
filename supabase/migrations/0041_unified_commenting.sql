-- Unified commenting & notifications.
--
-- Replaces the old PDF-coordinate annotation model with block-anchored comments
-- that work on any reviewable deliverable (stakeholder interviews, futures
-- research, city model districts, modules, brand-twin docs — everything except
-- the client-filled questionnaire). Comments anchor to a stable section slug
-- (`anchor_id`), not a pixel, so they survive re-render / RTL / re-export and
-- map 1:1 onto a RAG chunk.
--
-- Every comment raises a notification to the internal/admin team, deep-linked to
-- the exact section so they can apply requested changes.
--
-- Additive only: the old annotation tables are dropped in a later migration once
-- every surface has moved over.

-- Block-anchored, threaded comments attachable to ANY reviewable surface via a
-- polymorphic (subject_type, subject_id) key.
create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  -- which deliverable surface this comment lives on
  -- STAKEHOLDER_INTERVIEWS | FUTURES_RESEARCH | CITY_MODEL_DISTRICT | MODULE | BRAND_DOC
  subject_type text not null,
  -- report id / district key / module id — the surface's stable identifier
  subject_id text not null,
  -- threaded replies: root comments keep parent_id null
  parent_id uuid references public.review_comments(id) on delete cascade,
  -- stable block anchor (slug of the section heading); null = whole-document
  anchor_id text,
  -- human-readable heading captured at comment time, for re-anchoring + display
  anchor_label text,
  author_id uuid references public.users_profile(id),
  body text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists review_comments_subject_idx
  on public.review_comments (subject_type, subject_id);
create index if not exists review_comments_anchor_idx
  on public.review_comments (subject_type, subject_id, anchor_id);
create index if not exists review_comments_parent_idx
  on public.review_comments (parent_id);
create index if not exists review_comments_brand_idx
  on public.review_comments (brand_id);

-- In-app notifications. Every comment + review decision notifies the internal
-- team (and the client on decisions about their deliverables).
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete cascade,
  -- ADMIN | INTERNAL_TEAM | CLIENT — who should see it
  audience text not null,
  -- optional direct recipient; null = anyone in the audience for the brand
  recipient_id uuid references public.users_profile(id) on delete cascade,
  -- COMMENT_ADDED | COMMENT_REPLY | CHANGES_REQUESTED | APPROVED
  type text not null,
  title text not null,
  body text,
  -- deep link back to the exact section, e.g.
  -- /brand-integrated-brain/roadmap/city-model/purpose-form#anchor
  link_path text,
  subject_type text,
  subject_id text,
  comment_id uuid references public.review_comments(id) on delete cascade,
  actor_id uuid references public.users_profile(id),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, read_at);
create index if not exists notifications_brand_audience_idx
  on public.notifications (brand_id, audience, read_at);
create index if not exists notifications_subject_idx
  on public.notifications (subject_type, subject_id);

-- Deny-by-default RLS; all access is through the service-role admin client
-- behind app-level authorization, consistent with the rest of the schema.
alter table public.review_comments enable row level security;
alter table public.notifications enable row level security;

-- Atomic: insert a comment and fan out a notification to the internal team in
-- one txn, so a comment can never exist without its notification (or vice versa).
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
  p_notify_body text
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
    p_brand_id, 'INTERNAL_TEAM', v_type, p_notify_title, p_notify_body,
    p_link_path, p_subject_type, p_subject_id, v_comment_id, p_author_id
  );

  return query select v_comment_id, v_created_at;
end;
$$;
