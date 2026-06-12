-- Production-hardening for the commenting/notification tables (0041/0043):
-- CHECK constraints on the enum-like text columns so a code bug can never
-- write an unknown state, missing FK indexes for cascade targets and inbox
-- filters, and a guard that CLIENT-audience notifications always carry the
-- brand that scopes who may read them.

alter table public.review_comments
  add constraint review_comments_subject_type_check
  check (subject_type in (
    'STAKEHOLDER_INTERVIEWS',
    'FUTURES_RESEARCH',
    'CITY_MODEL_DISTRICT',
    'MODULE',
    'BRAND_DOC'
  ));

alter table public.notifications
  add constraint notifications_audience_check
  check (audience in ('ADMIN', 'INTERNAL_TEAM', 'CLIENT'));

-- A CLIENT notification without a brand would be readable by no one (the
-- client inbox filter is brand-scoped) — reject it at write time instead.
alter table public.notifications
  add constraint notifications_client_brand_check
  check (audience <> 'CLIENT' or brand_id is not null);

alter table public.deliverable_markdown
  add constraint deliverable_markdown_status_check
  check (status in ('PENDING', 'RAW', 'READY', 'FAILED'));

-- Cascade target: deleting a comment must not seq-scan notifications.
create index if not exists notifications_comment_idx
  on public.notifications (comment_id);

-- The inbox excludes the viewer's own activity (actor_id filter on every load).
create index if not exists notifications_actor_idx
  on public.notifications (actor_id);
