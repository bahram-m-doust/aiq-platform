-- Seed the agents catalog (reference data).
--
-- The Brand Brain page and the Phase 04 "Agent Deployment" substep both depend
-- on the BRAND_INTEGRATOR_BRAIN row existing in public.agents with
-- is_active = true. That row was previously only created by the separate
-- seeds-all.sql script, so any environment that ran migrations but not the seed
-- ended up with getBrandBrainAgent() returning null ("Agent unavailable") and
-- activateBrandBrainAgent() silently no-op'ing (Brain Build stuck at 3/4).
--
-- Folding the catalog into a migration makes the agent reliably present in every
-- environment. Idempotent: re-running re-activates and refreshes the name.

insert into public.agents (key, name, is_active)
values
  ('BRAND_INTEGRATOR_BRAIN', 'Brand Integrator Brain', true),
  ('STORY_TELLER', 'Story Teller', true),
  ('IMAGE_GENERATOR', 'Image Generator', true),
  ('VIDEO_GENERATOR', 'Video Generator', true),
  ('CAMPAIGN_MAKER', 'Campaign Maker', true),
  ('BRAND_DIGITAL_ACTIVATION', 'Brand Digital Activation', true)
on conflict (key) do update
  set name = excluded.name,
      is_active = true;

notify pgrst, 'reload schema';
