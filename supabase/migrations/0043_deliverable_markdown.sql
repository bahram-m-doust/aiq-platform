-- LLM-generated markdown cache for uploaded deliverables.
--
-- Admins upload a PDF; an automation extracts its text and uses the LLM to
-- restructure it into clean Markdown with proper headings. That markdown is
-- cached here (keyed by the source file) so the unified viewer renders it and
-- the RAG pipeline chunks it by heading — without re-running the LLM on every
-- page load. Images are not carried (PDF→text drops them); markdown is for the
-- text + heading structure that RAG and section-anchored comments need.

create table if not exists public.deliverable_markdown (
  file_id uuid primary key references public.files(id) on delete cascade,
  subject_type text,
  subject_id text,
  markdown text not null,
  -- PENDING | READY | FAILED — lets the UI show generation state
  status text not null default 'READY',
  error text,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deliverable_markdown_subject_idx
  on public.deliverable_markdown (subject_type, subject_id);

-- Deny-by-default RLS; all access via the service-role admin client.
alter table public.deliverable_markdown enable row level security;
