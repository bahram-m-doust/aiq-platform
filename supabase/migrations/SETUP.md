# Supabase Database Setup

Run migrations in order against your Supabase project. For manual setup, the
fastest path is the Supabase Dashboard SQL Editor.

## Fresh Project

1. Open Supabase Dashboard -> SQL Editor.
2. Paste and run `supabase/migrations/setup-all.sql`.
   - This generated script is intended only for an empty project.
   - It includes every numbered migration through
     `0043_deliverable_markdown.sql`.
   - Regenerate it after adding a migration with
     `npm run db:generate-bundles`.
   - On Supabase Cloud the script intentionally does **not** run
     `alter table storage.objects enable/force row level security;` -
     those statements require the `supabase_storage_admin` role and
     RLS on `storage.objects` is already enabled by default.
3. Paste and run seed files in this order:
   - `supabase/seeds/plans.sql`
   - `supabase/seeds/agents.sql`
   - `supabase/seeds/questions_sections.sql`
   - `supabase/seeds/questions.sql`
4. Reload the PostgREST schema cache:

```sql
NOTIFY pgrst, 'reload schema';
```

5. Verify the latest tables exist, including `rate_limits`, `demo_requests`,
   `knowledge_chunks`, `brand_api_keys`, `agent_run_usage`,
   `ai_usage_reservations`, `stakeholder_interview_reports`,
   `brand_agent_settings`, `futures_research_reports`, and
   `storage_cleanup_jobs`.

## Existing Project

If the base schema already exists, do not skip ahead. Run only the missing
migrations in numeric order:

- `0001_initial_schema.sql`
- `0002_add_access_key_resend_email_id.sql`
- `0003_add_change_request_reason.sql`
- `0004_create_private_file_bucket.sql`
- `0005_unique_knowledge_files_brand_file.sql`
- `0006_tighten_users_profile_role.sql`
- `0007_intake_builder_status.sql`
- `0008_enable_rls_deny_by_default.sql`
- `0009_performance_indexes.sql`
- `0010_rate_limits.sql`
- `0011_demo_requests.sql`
- `0012_pgvector_knowledge_chunks.sql`
- `0013_brand_api_keys.sql`
- `0014_brand_icons.sql`
- `0015_openrouter_ops.sql`
- `0018_ensure_brand_ops_columns.sql`
- `0019_fast_intake_autosave.sql`
- `0020_batch_intake_autosave.sql`
- `0021_stakeholder_interviews.sql`
- `0022_stakeholder_annotation_replies.sql`
- `0023_plan_credits.sql`
- `0024_brand_agent_settings.sql`
- `0025_futures_research.sql`
- `0026_futures_research_storyline.sql`
- `0027_atomic_workflows.sql`
- `0028_ai_budget_reservations.sql`
- `0029_atomic_file_workflows.sql`
- `0030_atomic_module_review.sql`
- `0031_atomic_rag_promotion.sql`
- `0032_storage_cleanup_outbox.sql`
- `0033_atomic_brand_access_grants.sql`
- `0034_atomic_rag_approval.sql`
- `0035_release_race_hardening.sql`
- `0036_atomic_brand_creation.sql`
- `0037_atomic_intake_reordering.sql`
- `0038_atomic_redeemed_brand_membership.sql`
- `0039_rag_approval_consistency.sql`
- `0040_city_model_district_files.sql`
- `0041_unified_commenting.sql`
- `0042_drop_pdf_annotations.sql`
- `0043_deliverable_markdown.sql`

## Required Supabase Dashboard Configuration

1. Authentication -> Providers -> Google: enable and paste Google OAuth Client
   ID and Secret if Google sign-in is used.
2. Authentication -> URL Configuration:
   - Site URL: `http://localhost:3000` for development, production origin for
     production.
   - Additional Redirect URLs: include `http://localhost:3000/callback` and
     `https://<your-domain>/callback`.
3. Authentication -> Sign-In Providers -> Email: keep enabled.
4. Authentication -> Sign-In Providers -> Allow linking of identities with the
   same email: ON.
5. Storage: confirm bucket `bextudio-files` is private.

## Security Expectations

- RLS is enabled and forced with deny-by-default policies for public app
  tables.
- Browser clients must not query business tables directly with anon/auth keys.
- The app uses the Supabase service role only from server-side code.
- `rate_limits` is private and written through the service-role RPC
  `increment_rate_limit`.

## Creating The First Platform Owner

Load local env values first, then run:

```powershell
npx tsx scripts/invite-admin.ts owner@example.com
```

After the user accepts the invite and signs in once, run the same command again
to promote the profile to `PLATFORM_OWNER`.

## Common Setup Errors

- Missing `users_profile`: migrations were not applied.
- Missing `rate_limits`: `0010_rate_limits.sql` was not applied.
- `PGRST002`: run `NOTIFY pgrst, 'reload schema';` or restart the Supabase
  project.
- Service role failures: re-copy `SUPABASE_SERVICE_ROLE_KEY` into the server
  environment.
- A notice about skipping the brand icon storage policy means the SQL Editor
  role does not own `storage.objects`. Create the public-read policy through
  the Storage UI; application tables remain deny-by-default.
