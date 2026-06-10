# Netlify Readiness

This project can be prepared for Netlify without changing the cPanel path. Keep
the app as a server-rendered Next.js app; do not enable static export.

## Build Settings

Use these Netlify build settings:

- Build command: `npm run build`
- Publish directory: `.next`

The repository also includes `netlify.toml` with the same values. Do not add
secrets to `netlify.toml`.

`@netlify/plugin-nextjs` is explicitly enabled because a raw `.next` publish
uploads no Next.js functions. A healthy Netlify deploy should not say
`0 new function(s) to upload` for this app; it should run the Next.js runtime
adapter and create server functions for App Router dynamic routes.

## Environment Variables

Set these in the Netlify dashboard with the narrowest scope that still supports
the app. Use deployment-specific values for each Netlify site.

Required public/config values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `APP_BASE_URL`
- `ADMIN_BASE_URL`

Required server-only secret:

- `SUPABASE_SERVICE_ROLE_KEY`
- `KEY_ENCRYPTION_KEY`
- `KEY_ENCRYPTION_ACTIVE_KEY_ID`

Optional server-only secrets for enabled features:

- `OPENROUTER_API_KEY`
- `RESEND_API_KEY`

Optional non-secret config:

- `OPENROUTER_MODEL`
- `EMAIL_FROM`

Remove unused future envs from Netlify for this MVP. The current runtime does
not read `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, or `SMTP_PASS`.

`NEXT_PUBLIC_SUPABASE_URL` must remain the Supabase Project URL from Project
Settings > API. It is not the Netlify app URL. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
is intentionally public and must not be treated like a private secret. Keep
`SUPABASE_SERVICE_ROLE_KEY`, `KEY_ENCRYPTION_KEY`, `OPENROUTER_API_KEY`, and `RESEND_API_KEY`
server-only and never expose them in client code, docs, screenshots, or support
messages.

## Secret Scanning

If Netlify fails with "Secrets scanning found secrets in build", first remove
unused env vars and make sure public config values are not marked as private
secrets. Do not disable scanning with `SECRETS_SCAN_ENABLED=false`.

The code reads server-only secrets through runtime env helpers to avoid baking
secret values into `.next` artifacts. If Netlify still reports a known
server-only key after this cleanup, use `SECRETS_SCAN_OMIT_KEYS` only for the
specific required server key that Netlify reports, and only after confirming
the value is not in static HTML or client JavaScript.

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
- `/home` redirects unauthenticated users to `/login`.
- `/admin` redirects unauthenticated users to `/admin/login`.
- `/invite/accept` renders the logged-out invitation prompt.
- Google/email callback returns through `/callback` on the Netlify domain.

Stop if any secret, raw access key, token, signed URL, prompt, answer, or full
email appears in browser output, logs, docs, or support messages.
