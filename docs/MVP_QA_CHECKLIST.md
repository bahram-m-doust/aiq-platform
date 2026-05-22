# MVP QA Checklist

Use this checklist before a manual upload or production handoff. Keep secrets
out of screenshots, logs, tickets, and chat messages.

## Automated Checks

- `npm run verify`
- `npm run build`
- `npm audit --omit=dev`
- `npm run test:smoke`
- `Invoke-WebRequest http://127.0.0.1:3001/api/health`
- If Playwright cannot download Chromium, run:
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" npm run test:smoke`

## Manual Smoke Flow

- Auth: register a test user, confirm login/logout works, and confirm invalid
  credentials show a generic error.
- Access key: redeem a valid key once, retry the same key, and confirm the
  second attempt is rejected without exposing key details.
- Dashboard: confirm inactive users see the locked state and active users see
  only their current brand workspace.
- Intake: answer one question, reload the page, confirm the saved answer, and
  confirm final submit locks the intake.
- Invitations: create a Brand Specialist invite, open the accept URL while
  logged out, sign in as the target email, and confirm membership is created.
- Files: upload an Owner file, upload a Specialist file, approve/reject a
  pending Specialist file, and confirm downloads use signed URLs.
- Modules: upload an artifact, send it to client review, approve it, and create
  one change request.
- Admin: create an access key, run a manual plan grant, review audit logs, and
  confirm non-owner users cannot open admin pages.
- Agents/Brain: ask Brand Brain or run one active agent only when the current
  brand knowledge state is ready; confirm prompts and answers are not copied
  into audit logs.

## Reliability Checks

- Try rapid repeat submits on login, access key redemption, invitations, file
  upload, Brand Brain, and agent run; confirm the app eventually returns
  `Too many attempts. Please try again later.`
- Inspect server logs for failures and confirm they contain action context but
  no raw access keys, passwords, tokens, signed URLs, full email fields, prompts,
  or answers.
- Confirm Supabase migration `0010_rate_limits.sql` has run before expecting
  production rate limits to enforce.
