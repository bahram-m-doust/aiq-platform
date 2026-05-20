insert into public.agents (key, name)
values
  ('BRAND_INTEGRATOR_BRAIN', 'Brand Integrator Brain'),
  ('STORY_TELLER', 'Story Teller'),
  ('IMAGE_GENERATOR', 'Image Generator'),
  ('VIDEO_GENERATOR', 'Video Generator'),
  ('CAMPAIGN_MAKER', 'Campaign Maker'),
  ('BRAND_DIGITAL_ACTIVATION', 'Brand Digital Activation')
on conflict (key) do update
set name = excluded.name;
