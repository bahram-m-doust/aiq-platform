# Manual Database Backup (free-tier stopgap)

The Supabase **Free** plan has **no automated daily backups / PITR**. Until the
project is upgraded to **Pro** (which adds daily backups + a PITR add-on), take
**manual** backups so a bad migration, a buggy write, or a tester wiping data is
recoverable. This is the single biggest data-loss risk during the test phase.

## What you need

- The **Session pooler** connection string: Supabase Dashboard →
  **Project Settings → Database → Connection string → "Session pooler"**. It
  looks like:
  `postgresql://postgres.vxjzzhvjuzeeskgzzqmx:<DB-PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres`
  (Use the pooler host, **not** `db.<ref>.supabase.co` — that one is IPv6-only
  and won't connect from most networks.)
- `pg_dump` / `pg_restore`. On Windows you can either install the PostgreSQL
  client tools, or use Docker (you already have Docker) — see below.

## Take a backup

PowerShell, using Docker (no local Postgres install needed). Use a Postgres
image **>= the server version** (Supabase is on PG 15+, so 16 is safe):

```powershell
$conn = "postgresql://postgres.vxjzzhvjuzeeskgzzqmx:<DB-PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
docker run --rm postgres:16 pg_dump "$conn" -Fc | Set-Content -Encoding Byte "bextudio-$stamp.dump"
```

`-Fc` = custom (compressed) format, restorable with `pg_restore`. This dumps the
full `public` schema + data. (Auth users live in the `auth` schema and are
managed by Supabase; this dump covers your application data in `public`.)

If you have native `pg_dump` installed instead of Docker:

```powershell
pg_dump "$conn" -Fc -f "bextudio-$stamp.dump"
```

## Restore (into a fresh / recovered project)

```powershell
$conn = "postgresql://postgres.<ref>:<DB-PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres"
docker run --rm -i postgres:16 pg_restore --clean --if-exists --no-owner -d "$conn" < bextudio-<stamp>.dump
```

Then reload PostgREST: run `notify pgrst, 'reload schema';` in the SQL Editor.

## Recommended cadence (test phase)

- Before every migration you apply by hand.
- Daily while testers are active (a scheduled task can run the command above).
- Keep the last ~7 dumps off-machine (cloud drive).

## After upgrading to Pro

Pro enables automated daily backups (and PITR as an add-on) in the dashboard —
manual dumps become a nice-to-have rather than the only safety net.
