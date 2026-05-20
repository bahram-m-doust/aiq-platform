insert into public.question_sections (key, title, order_index)
values
  ('COMPANY', 'Company', 1),
  ('CONSUMER_MARKET_SEGMENTATION', 'Consumer / Market Segmentation', 2),
  ('USER_PERSONA', 'User Persona', 3),
  ('PRODUCTS_SERVICES', 'Products / Services', 4),
  ('CONTEXT', 'Context', 5),
  ('STYLE_TONE_OF_VOICE', 'Style / Tone of Voice', 6)
on conflict (key) do nothing;
