-- Diagnostic: run this in Supabase SQL Editor to verify that migration 0018
-- (and the original 0014/0015) actually applied to your database. Each result
-- set should be non-empty if everything is in place.

-- 1) brands columns added by 0014/0015 (icon_path + brand-ops)
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'brands'
  and column_name in (
    'icon_path',
    'monthly_budget_cents',
    'default_text_model',
    'default_image_model'
  )
order by column_name;
-- Expected: 4 rows. If 0 rows -> migration 0018 did NOT apply.

-- 2) usage ledger table from 0015
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'agent_run_usage'
order by ordinal_position;
-- Expected: id, run_id, brand_id, kind, model, prompt_tokens,
-- completion_tokens, image_count, cost_cents, created_at.

-- 3) Storage buckets
select id, name, public from storage.buckets
where id in ('brand-icons', 'agent-images')
order by id;
-- Expected: 2 rows. agent-images.public = false, brand-icons.public = true.

-- 4) Force PostgREST (the API layer Supabase JS talks to) to reload its
--    schema cache. Sometimes new columns "exist" in Postgres but the JS
--    client still gets 42703 because the API cached the old schema.
notify pgrst, 'reload schema';
