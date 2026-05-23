# Supabase Database Setup

Run migrations in order against your Supabase project. For manual setup, the
fastest path is the Supabase Dashboard SQL Editor.

## Fresh Project

1. Open Supabase Dashboard -> SQL Editor.
2. Paste and run `supabase/migrations/setup-all.sql`.
   - This consolidated script is intended for fresh projects and is
     idempotent for the current MVP schema.
   - It includes migrations through `0010_rate_limits.sql`.
3. Paste and run seed files in this order:
   - `supabase/seeds/plans.sql`
   - `supabase/seeds/agents.sql`
   - `supabase/seeds/questions_sections.sql`
   - `supabase/seeds/questions.sql`
4. Reload the PostgREST schema cache:

```sql
NOTIFY pgrst, 'reload schema';
```

5. Verify these tables exist: `users_profile`, `brands`, `plans`,
   `question_sections`, `questions`, `agent_runs`, `audit_logs`,
   `rate_limits`.

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

If the project is already at `0009_performance_indexes.sql`, run only
`0010_rate_limits.sql`, then reload PostgREST:

```sql
NOTIFY pgrst, 'reload schema';
```

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
