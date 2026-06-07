-- Threaded replies for stakeholder-interview annotations.
-- A reply has parent_id set to the root annotation; root comments keep
-- parent_id null and are the ones pinned on the PDF.

alter table public.stakeholder_interview_annotations
  add column if not exists parent_id uuid
  references public.stakeholder_interview_annotations(id) on delete cascade;

create index if not exists stakeholder_interview_annotations_parent_idx
  on public.stakeholder_interview_annotations (parent_id);
