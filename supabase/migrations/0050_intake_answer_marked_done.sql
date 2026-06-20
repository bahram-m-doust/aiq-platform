-- A questionnaire answer is "marked done" only when the user explicitly clicks
-- "Save & mark done". Autosave (typing + blur) still saves the value as a draft,
-- but never marks it done. The questionnaire overview's Unanswered warning box
-- lists questions that aren't marked done; section progress counts/badges stay
-- value-based exactly as before.
alter table public.intake_answers
  add column if not exists marked_done_at timestamptz;

notify pgrst, 'reload schema';
