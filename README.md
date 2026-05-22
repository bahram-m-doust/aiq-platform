# Bextudio Platform

Bextudio Platform is a private Next.js application for managing brand strategy workflows. It combines Supabase-backed authentication, role-based workspaces, intake forms, private file handling, module review flows, RAG approval, and AI-assisted brand/agent workflows.

## Stack

- Next.js App Router
- React and TypeScript
- Supabase Auth, Postgres, and private Storage
- OpenAI integrations for Brand Brain, agents, and RAG sync
- Vitest unit tests and Playwright E2E/smoke tests
- ESLint and TypeScript checks

## Main Areas

- `app/` - Next.js routes for auth, dashboard, admin, and public invitation flows.
- `features/` - Product workflows grouped by domain: auth, access keys, brands, intake, files, modules, change requests, invitations, RAG, agents, and admin.
- `lib/` - Shared platform utilities for Supabase, audit logging, email, security helpers, and common utilities.
- `supabase/` - Database migrations, seed data, and Supabase setup notes.
- `tests/` - Unit tests, test helpers, mocks, and Playwright E2E tests.
- `docs/` - Product, security, data model, setup, and planning documentation.

## Local Development

```bash
npm install
npm run dev
```

The app expects local environment variables based on `.env.example`. Production secrets must stay out of git and should only live in local, deployment, or secret-management environments.

## Verification

```bash
npm run verify
npm run build
npm run test:smoke
npm audit --omit=dev
```

The app also exposes a non-sensitive readiness endpoint at `/api/health`.

If Playwright cannot download its browser binary, run smoke/E2E tests with an installed Chrome executable:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3001'
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run test:smoke
```

## Security Notes

- Login is identity, not access.
- Access is enforced server-side through profile, role, membership, entitlement, and resource scope checks.
- Supabase service role usage must remain server-only.
- Brand files are private by default and should be served only through permission-checked signed URLs.
- Raw access keys, API keys, signed URLs, and production secrets must not be committed or pasted into public tools.

## Documentation

Start with:

- `docs/Bextudio_Project_Overview.md`
- `docs/Bextudio_PRD.md`
- `docs/Bextudio_Roles_Permissions.md`
- `docs/Bextudio_Security_Rules.md`
- `docs/Bextudio_Database_Schema.md`
- `docs/MVP_RELEASE_RUNBOOK.md`
- `docs/MVP_QA_CHECKLIST.md`
- `docs/MONITORING.md`
- `docs/NETLIFY_READINESS.md`
