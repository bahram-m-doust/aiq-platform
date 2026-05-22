# MVP Release Runbook

This runbook prepares the app for final MVP QA and manual upload. It does not
cover cPanel deployment steps, CI/CD, Docker, paid observability, or RAG
refactors.

## 1. Environment Checklist

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_BASE_URL`
- `ADMIN_BASE_URL`

Optional for enabled features:

- `OPENAI_API_KEY`
- `OPENAI_BRAIN_MODEL`
- `OPENAI_AGENT_MODEL`
- `RESEND_API_KEY`
- `EMAIL_FROM`

Do not add secrets to git, docs screenshots, issue text, or chat messages.

## 2. Supabase Checklist

Fresh project:

1. Run `supabase/migrations/setup-all.sql`.
2. Run seeds in order:
   - `supabase/seeds/plans.sql`
   - `supabase/seeds/agents.sql`
   - `supabase/seeds/questions_sections.sql`
3. Run `NOTIFY pgrst, 'reload schema';`.

Existing project:

1. Run missing migrations in numeric order through `0010_rate_limits.sql`.
2. Re-run seeds only if the environment is missing plan, agent, or intake
   configuration rows.
3. Run `NOTIFY pgrst, 'reload schema';`.

Confirm:

- `bextudio-files` bucket is private.
- `rate_limits` exists.
- RLS is enabled and forced for public app tables.
- No anon/auth policies were added for business tables.

## 3. Verification Commands

```powershell
npm run verify
npm run build
npm audit --omit=dev
```

Health check:

```powershell
Invoke-WebRequest http://127.0.0.1:3001/api/health
```

Smoke with local Chrome:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3001'
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run test:smoke
```

If `next build` rewrites `next-env.d.ts`, do not include that generated change
in the release commit.

## 4. Manual QA Order

1. Auth: register, log in, log out, invalid password.
2. Admin bootstrap: create or promote the first Platform Owner.
3. Access key: create, redeem once, retry redeemed key.
4. Brand workspace: confirm inactive and active dashboard states.
5. Intake: save an answer, reload, final submit.
6. Invitation: create Specialist invite, accept with target email.
7. Files: upload, approve/reject Specialist file, download via signed URL.
8. Modules: upload artifact, send to client, approve, request change.
9. Agents/Brain: run only when current brand knowledge is ready.
10. Audit: confirm sensitive values are not visible in audit logs.
11. Rate limits: repeat-submit login, access key, invite, upload, Brain, and
    agent run until the controlled rate-limit message appears.

## 5. Stop Conditions

Stop the release pass if any of these happen:

- A secret appears in server logs, audit logs, browser output, or docs.
- A public route exposes dashboard/admin data while logged out.
- Supabase migrations fail or leave `rate_limits` missing.
- `npm run verify`, `npm run build`, or `npm audit --omit=dev` fails.
