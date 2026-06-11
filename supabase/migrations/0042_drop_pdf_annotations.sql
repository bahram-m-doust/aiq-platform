-- Remove the old PDF-coordinate annotation system. Block-anchored comments now
-- live in public.review_comments (migration 0041), which covers every
-- deliverable surface. The report/upload tables are unchanged — only the
-- coordinate-anchored annotation tables are dropped.

drop table if exists public.stakeholder_interview_annotations cascade;
drop table if exists public.futures_research_annotations cascade;
