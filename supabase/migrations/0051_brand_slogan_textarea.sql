-- Brand Slogan was the only questionnaire question rendered as a single-line
-- text input; every other question uses a multi-line textarea. Align it with
-- the rest so the field renders the same component. Only flips the legacy
-- 'text' value, leaving any other input type untouched.
update public.questions
  set input_type = 'textarea'
  where key = 'BRAND_SLOGAN'
    and input_type = 'text';

notify pgrst, 'reload schema';
