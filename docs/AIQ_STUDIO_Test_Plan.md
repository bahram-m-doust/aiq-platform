# AIQ STUDIO MVP — Test Plan v0.1

## 1. هدف

این سند تست‌های لازم برای MVP را تعریف می‌کند. چون محصول با برندهای محرمانه، فایل‌های استراتژیک، payment/access، RAG و Agent سروکار دارد، تست فقط UI نیست؛ permission، security، workflow و data isolation هم باید تست شود.

## 2. Test Categories

```text
1. Auth Tests
2. Access Key Tests
3. Entitlement Tests
4. Dashboard State Tests
5. Intake Tests
6. Lock & Snapshot Tests
7. Change Request Tests
8. Invitation Tests
9. File Security Tests
10. Module Workflow Tests
11. RAG Approval Tests
12. Agent Tests
13. Audit Log Tests
14. Admin Tests
15. Deployment Smoke Tests
```

## 3. Auth Tests

### AUTH-001 — User registration

Precondition:
```text
No account exists for email.
```

Steps:
```text
1. Go to /register.
2. Enter valid email/password.
3. Submit.
```

Expected:
```text
- Supabase user is created.
- users_profile is created.
- User redirects to Dashboard.
- Dashboard is inactive if no access exists.
```

### AUTH-002 — User login

Expected:
```text
- User can login.
- Session persists.
- User can access /home.
```

### AUTH-003 — Protected route

Expected:
```text
- Unauthenticated user cannot access /home.
- Redirect to /login.
```

## 4. Access Key Tests

### ACCESS-001 — Valid CREATE_BRAND key

Expected:
```text
- User redeems key.
- System allows brand creation.
- Key status changes to REDEEMED.
- Audit log created.
```

### ACCESS-002 — Expired key

Expected:
```text
- Redemption fails.
- User sees clear error.
- Key remains expired/unusable.
```

### ACCESS-003 — Wrong email

Expected:
```text
- If target_email does not match user email, redemption fails.
```

### ACCESS-004 — Reused one-time key

Expected:
```text
- Second redemption attempt fails.
```

### ACCESS-005 — CLAIM_BRAND key

Expected:
```text
- User claims existing brand.
- Owner membership is created.
- Dashboard becomes active.
```

### ACCESS-006 — JOIN_BRAND key

Expected:
```text
- User joins existing brand with correct role.
- Specialist gets Specialist permissions only.
```

## 5. Entitlement Tests

### ENT-001 — Manual plan grant

Expected:
```text
- Platform Owner grants plan manually.
- brand_entitlement is created.
- agent_entitlements are created.
- Dashboard becomes active.
- Audit log created.
```

### ENT-002 — Suspended entitlement

Expected:
```text
- Dashboard shows access suspended/expired state.
- Agents cannot run.
```

## 6. Dashboard Tests

### DASH-001 — No access state

Expected:
```text
- User sees inactive Dashboard.
- Intake/modules/agents unavailable.
```

### DASH-002 — Active brand state

Expected:
```text
- User sees active Dashboard.
- Strategic Intake is available.
```

## 7. Intake Tests

### INTAKE-001 — Render six sections

Expected:
```text
Sections appear:
1. Company
2. Consumer / Market Segmentation
3. User Persona
4. Products / Services
5. Context
6. Style / Tone of Voice
```

### INTAKE-002 — Autosave answer

Expected:
```text
- User enters answer.
- Answer saves to intake_answers.
- Updated_at changes.
- Audit log created or batched according to implementation policy.
```

### INTAKE-003 — Completion calculation

Expected:
```text
- Completion percent updates accurately.
- Final submit disabled below 100%.
```

### INTAKE-004 — Specialist cannot answer/final submit

Expected:
```text
- Specialist cannot access edit mode.
- Specialist cannot final submit.
```

## 8. Lock & Snapshot Tests

### LOCK-001 — Final submit

Expected:
```text
- User sees warning modal.
- On confirm, intake status becomes LOCKED.
- intake_snapshot is created.
- Direct editing disabled.
- Audit log created.
```

### LOCK-002 — Editing locked answer fails

Expected:
```text
- Server rejects edit request.
- UI shows locked state.
```

## 9. Change Request Tests

### CR-001 — Create change request for locked section

Expected:
```text
- Owner can submit change request.
- Request status = REQUESTED.
- Admin/Supervisor can see request.
- Locked answer is not edited directly.
```

### CR-002 — Specialist cannot create final correction unless permitted

Expected:
```text
- Specialist can comment only.
- Cannot create official correction request unless policy allows.
```

## 10. Invitation Tests

### INV-001 — Invite Specialist

Expected:
```text
- Owner enters email and expiry.
- JOIN_BRAND Access Key created.
- Email sent.
- Audit log created.
```

### INV-002 — Expired invitation

Expected:
```text
- Accept fails after expiry.
```

## 11. File Security Tests

### FILE-001 — Upload private file

Expected:
```text
- File stored in private bucket.
- files record created.
- No public URL.
```

### FILE-002 — Signed download URL

Expected:
```text
- Download URL generated only after permission check.
- Download audited.
```

### FILE-003 — Specialist upload approval

Expected:
```text
- Specialist upload status = PENDING_OWNER_APPROVAL.
- Owner can approve/reject.
```

## 12. Module Workflow Tests

### MOD-001 — Internal Specialist upload

Expected:
```text
- Internal Specialist uploads DOCX/PDF.
- Module status remains INTERNAL_REVIEW or IN_PROGRESS.
- Client cannot see it yet.
```

### MOD-002 — Supervisor sends to client review

Expected:
```text
- Supervisor approves.
- Module status = CLIENT_REVIEW.
- Client can view PDF preview.
```

### MOD-003 — Client approval

Expected:
```text
- Owner approves module.
- Module status = CLIENT_APPROVED.
- RAG sync does not start automatically.
```

### MOD-004 — Client change request

Expected:
```text
- Owner requests change.
- Module status = CLIENT_CHANGE_REQUESTED.
- Internal team sees request.
```

## 13. RAG Tests

### RAG-001 — Client approval is not enough

Expected:
```text
- CLIENT_APPROVED file is not synced until RAG_APPROVED.
```

### RAG-002 — RAG approval

Expected:
```text
- Supervisor/Platform Owner approve.
- rag_status = RAG_APPROVED.
- Audit log created.
```

### RAG-003 — Sync only approved files

Expected:
```text
- Sync function uploads only RAG_APPROVED files.
- Draft/internal files ignored.
```

### RAG-004 — Brand isolation

Expected:
```text
- Brand A vector store does not include Brand B files.
```

## 14. Agent Tests

### AGENT-001 — Brain locked before sync

Expected:
```text
- Brand Brain unavailable before RAG_SYNCED.
```

### AGENT-002 — Agent locked by plan

Expected:
```text
- Agent not included in plan cannot activate.
```

### AGENT-003 — Agent activation

Expected:
```text
- Owner activates available agent.
- Status = ACTIVE.
- Audit log created.
```

### AGENT-004 — Agent run logged

Expected:
```text
- Input/output saved in agent_runs.
- brand_id attached.
- provider/model stored.
```

## 15. Audit Tests

### AUDIT-001 — Manual plan grant audit

Expected:
```text
- audit_logs row exists with action plan_granted.
```

### AUDIT-002 — File download audit

Expected:
```text
- file_downloaded action logged.
```

### AUDIT-003 — RAG approval audit

Expected:
```text
- rag_approved action logged.
```

## 16. Deployment Smoke Tests

After deployment:

```text
- App loads.
- Login works.
- Supabase connection works.
- Storage upload works.
- Email sending works.
- OpenAI key works in staging.
- Admin route protected.
- Health endpoint returns OK.
```

## 17. Minimum Test Automation Recommendation

```text
Unit tests:
- access key validation
- permission functions
- intake completion calculation
- RAG eligibility

Integration tests:
- redeem access key
- final submit lock
- module approval
- RAG sync eligibility

E2E tests:
- locked dashboard
- intake flow
- manual entitlement grant
- module client review
```
