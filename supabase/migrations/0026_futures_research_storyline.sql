-- Futures Research · optional Storyline output.
-- Alongside the analysis PDF, the Bextudio team can attach an interactive
-- Storyline (a single self-contained HTML file) that the client views inline.
-- Stored in the shared private `files` table (bucket: bextudio-files) and
-- streamed through an authorized route, same as the PDF.

alter table public.futures_research_reports
  add column if not exists storyline_file_id uuid
  references public.files(id) on delete set null;
