# Monitoring

This MVP uses low-cost operational checks only. There is no paid observability,
CI/CD, log drain, or external APM requirement in this phase.

## Health Endpoint

Use:

```text
GET /api/health
```

Expected healthy response:

```json
{
  "service": "bextudio-platform",
  "status": "ok",
  "timestamp": "2026-05-22T00:00:00.000Z",
  "checks": {
    "env": "ok",
    "supabase": "ok"
  }
}
```

The endpoint returns `200` when required environment variables are present and
a lightweight Supabase service-role query succeeds. It returns `503` when the
app is not ready. It does not return secrets, database rows, tokens, user data,
or error details.

## Free Uptime Monitoring

For manual cPanel-style hosting, point a free uptime monitor at:

```text
https://<your-domain>/api/health
```

Recommended settings:

- Interval: 5 minutes.
- Expected status: `200`.
- Alert channels: email or Telegram.
- Pause alerts during planned manual uploads.

## What To Check On Alert

1. Confirm the app process is running.
2. Confirm `APP_BASE_URL` and `ADMIN_BASE_URL` match the public domain.
3. Confirm Supabase env values are set on the server.
4. Confirm Supabase project is reachable.
5. Confirm migrations through `0010_rate_limits.sql` have run.
6. Check server logs for sanitized `[health] supabase check failed` messages.

## Current Limits

- No request tracing.
- No metrics dashboard.
- No centralized log storage.
- No queue or async job monitoring.
- RAG and agent cost/rate dashboards are deferred to a later scale phase.
