# Supabase Database Setup

Run the migrations **in order** against your Supabase project. The fastest path is the SQL Editor in the Supabase Dashboard.

1. Open **Supabase Dashboard → SQL Editor**.
2. Paste the contents of **`setup-all.sql`** (consolidated, idempotent) into a new query and run.
   - Safe to run on a fresh project **or** an existing project — uses `create table if not exists` and `create index if not exists` throughout.
   - If you prefer step-by-step migrations, paste each file in order:
     - `0001_initial_schema.sql`
     - `0002_add_access_key_resend_email_id.sql`
     - `0003_add_change_request_reason.sql`
     - `0004_create_private_file_bucket.sql`
     - `0005_unique_knowledge_files_brand_file.sql`
     - `0006_tighten_users_profile_role.sql`
3. Verify by going to **Database → Tables** and confirming `public.users_profile` exists with columns `id, auth_user_id, email, full_name, global_role, created_at, updated_at`.

### Already-set-up project that only needs the latest migration

If you see `ERROR: 42P07: relation "users_profile" already exists`, your project already has the base schema. Run only the newest migration:

```sql
-- Paste only the contents of 0006_tighten_users_profile_role.sql
```

Or re-run `setup-all.sql` after pulling the latest changes — it is now idempotent.

## Diagnosing the "We could not prepare your profile" error

The redirect now appends the underlying cause to the message, for example:

- `Database is not set up: the users_profile table is missing. Apply Supabase migrations 0001–0006.`
  → Migrations have not been applied. Follow the steps above.
- `Database schema is out of date (missing column).`
  → A migration is missing or an older version of the schema is in place.
- `Service role key is invalid or missing — check SUPABASE_SERVICE_ROLE_KEY.`
  → Re-copy the service role key from the Supabase Dashboard into `.env.local`.

## Required Supabase Dashboard configuration

1. **Authentication → Providers → Google**: enable, paste Google OAuth Client ID + Secret.
2. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` for development, your production domain otherwise.
   - Additional Redirect URLs: include `http://localhost:3000/callback` and `https://<your-domain>/callback`.
3. **Authentication → Sign-In Providers → Email**: keep enabled.
4. **Authentication → Sign-In Providers → "Allow linking of identities with the same email"**: ON, so email/password and Google sign-ins for the same address resolve to a single account.

## Google Cloud OAuth client

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client (Web).
2. Authorized JavaScript origins: `http://localhost:3000` and the production origin.
3. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback` (Supabase shows this string on the Google provider page).
4. Copy Client ID + Secret into the Supabase Google provider config.

## Creating the first Platform Owner

```bash
set -a && . ./.env.local && set +a
npx tsx scripts/invite-admin.ts owner@example.com
# Owner receives an invite email; after they accept and sign in once, run:
npx tsx scripts/invite-admin.ts owner@example.com
# The second run promotes their profile to PLATFORM_OWNER.
```
