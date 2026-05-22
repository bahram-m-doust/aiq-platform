# Netlify Readiness

This project can be prepared for Netlify without changing the cPanel path. Keep
the app as a server-rendered Next.js app; do not enable static export.

## Build Settings

Use these Netlify build settings:

- Build command: `npm run build`
- Publish directory: `.next`

The repository also includes `netlify.toml` with the same values. Do not add
secrets to `netlify.toml`.

## Environment Variables

Set these in the Netlify dashboard for both build-time and runtime functions.
Use deployment-specific values for each Netlify site.

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

`NEXT_PUBLIC_SUPABASE_URL` must remain the Supabase Project URL from Project
Settings > API. It is not the Netlify app URL. Keep `SUPABASE_SERVICE_ROLE_KEY`
server-only and never expose it in client code, docs, screenshots, or support
messages.

## Supabase Auth URLs

In Supabase Dashboard > Authentication > URL Configuration:

- Set Site URL to the production Netlify or custom domain.
- Add the app callback redirect:
  `https://<netlify-domain>/callback**`

If a custom admin subdomain is used, add its callback too:

`https://<admin-domain>/callback**`

For Google OAuth, the Google Cloud authorized redirect URI remains the Supabase
callback:

`https://<project-ref>.supabase.co/auth/v1/callback`

## Preview Deploys

Auth callback URLs are origin-locked by `APP_BASE_URL` and `ADMIN_BASE_URL`.
Deploy previews only work for auth flows when those env vars and the Supabase
redirect allowlist match the preview or custom domain being tested.

For the first Netlify pass, prefer one fixed production/custom domain instead
of relying on changing preview URLs.

## Post-Deploy Smoke

After Netlify deploy succeeds, verify:

- `/api/health` returns `200` and `status: "ok"`.
- `/login` and `/register` render.
- `/dashboard` redirects unauthenticated users to `/login`.
- `/admin` redirects unauthenticated users to `/admin/login`.
- `/invite/accept` renders the logged-out invitation prompt.
- Google/email callback returns through `/callback` on the Netlify domain.

Stop if any secret, raw access key, token, signed URL, prompt, answer, or full
email appears in browser output, logs, docs, or support messages.
