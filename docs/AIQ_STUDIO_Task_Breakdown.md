# AIQ STUDIO MVP — Project Breakdown v0.1

## 1. Build Philosophy

```text
Spec-first Vibe Coding.
```

یعنی:

```text
1. Data Pack را source of truth قرار بده.
2. هر بار فقط یک feature بساز.
3. AI را برای ساخت کل پلتفرم یک‌جا prompt نکن.
4. هر feature باید acceptance criteria و test داشته باشد.
```

## 2. Epic Order

ترتیب ساخت را عوض نکن:

```text
00 Documentation & Setup
01 Auth & Base Layout
02 Locked Dashboard
03 Admin Foundation
04 Plans & Entitlements
05 Access Key System
06 Brand Creation & Claim
07 Strategic Brand Intake
08 Intake Lock & Snapshot
09 Change Requests
10 Team Invitation
11 File System
12 Module Workflow
13 RAG Approval Queue
14 OpenAI File Search Sync
15 Brand Integrator Brain
16 Agent Catalog & Activation
17 Five MVP Agents
18 QA & Hardening
19 Deployment Preparation
```

---

# Epic 00 — Documentation & Setup

## Goal

پروژه را برای ساخت آماده کن.

## Tasks

```text
00.01 Create repository
00.02 Add docs folder
00.03 Add .env.example
00.04 Initialize Next.js + TypeScript
00.05 Install Supabase client
00.06 Add Tailwind/shadcn if used
00.07 Add base layout
00.08 Add README_INDEX.md
```

## Acceptance Criteria

```text
- Project runs locally.
- Docs exist.
- Env variables are documented.
```

---

# Epic 01 — Auth & Base Layout

## Tasks

```text
01.01 Setup Supabase Auth client/server
01.02 Create login page
01.03 Create register page
01.04 Create logout action
01.05 Create middleware for protected routes
01.06 Create users_profile on first login
01.07 Redirect logged-in user to /home
```

## Acceptance Criteria

```text
- User can register/login/logout.
- /home requires authentication.
- New user gets users_profile.
```

---

# Epic 02 — Locked Dashboard

## Tasks

```text
02.01 Create dashboard route
02.02 Query user's brand memberships
02.03 Query active entitlements
02.04 If no active access, show inactive Dashboard
02.05 Add Access Key form placeholder
02.06 Add demo/contact CTA
```

## Acceptance Criteria

```text
- User without brand access sees inactive Dashboard.
- Intake/modules/agents are not visible/accessible.
```

---

# Epic 03 — Admin Foundation

## Tasks

```text
03.01 Define Platform Owner role
03.02 Create /admin route
03.03 Protect /admin route
03.04 Create Admin Dashboard
03.05 Create Brands list page
03.06 Create Users list page
03.07 Create Plans list page
03.08 Create Audit Logs page skeleton
```

## Acceptance Criteria

```text
- Non-admin cannot access /admin.
- Admin can view basic operational pages.
```

---

# Epic 04 — Plans & Entitlements

## Tasks

```text
04.01 Create plans table migration
04.02 Seed BASIC, ADVANCED, ENTERPRISE
04.03 Create brand_entitlements table
04.04 Create grantBrandAccess service
04.05 Create manual grant form
04.06 Create agent_entitlements from plan
04.07 Add audit log on grant
```

## Acceptance Criteria

```text
- Platform Owner can manually grant plan.
- Brand Dashboard becomes active after grant.
- Audit log exists.
```

---

# Epic 05 — Access Key System

## Tasks

```text
05.01 Create access_keys table
05.02 Create secure key generator
05.03 Create hash function
05.04 Create Admin create Access Key page
05.05 Create Redeem Access Key form
05.06 Implement CREATE_BRAND validation
05.07 Implement CLAIM_BRAND validation
05.08 Implement JOIN_BRAND validation
05.09 Add email-bound validation
05.10 Add expiry validation
05.11 Add audit logs
```

## Acceptance Criteria

```text
- Raw key is not stored.
- Expired/wrong-email/redeemed key fails.
- Valid key works according to type.
```

---

# Epic 06 — Brand Creation & Claim

## Tasks

```text
06.01 Create brand creation form
06.02 Redeem CREATE_BRAND key then create brand
06.03 Create Owner membership
06.04 Create default intake session
06.05 Create default modules based on plan
06.06 Redeem CLAIM_BRAND key
06.07 Attach user as Owner to existing brand
```

## Acceptance Criteria

```text
- User can create brand with CREATE_BRAND key.
- User can claim admin-created brand with CLAIM_BRAND key.
```

---

# Epic 07 — Strategic Brand Intake

## Tasks

```text
07.01 Create question_sections table
07.02 Create questions table
07.03 Seed six sections
07.04 Import current question bank
07.05 Create intake page
07.06 Create section navigation
07.07 Create question renderer
07.08 Implement autosave
07.09 Calculate section progress
07.10 Calculate total completion
07.11 Disable final submit until 100%
```

## Acceptance Criteria

```text
- Six sections show.
- All questions are required.
- Autosave works.
- Final submit disabled below 100%.
```

---

# Epic 08 — Intake Lock & Snapshot

## Tasks

```text
08.01 Create Final Submit modal
08.02 Validate completion = 100%
08.03 Lock intake session
08.04 Create intake_snapshot
08.05 Disable edits after lock
08.06 Notify internal team
08.07 Audit final submit
```

## Acceptance Criteria

```text
- Answers locked after submit.
- Snapshot exists.
- Direct edit blocked server-side.
```

---

# Epic 09 — Change Requests

## Tasks

```text
09.01 Create change_requests table
09.02 Create request form for locked section/question
09.03 Create request form for module
09.04 Create Admin/Supervisor review page
09.05 Add statuses
09.06 Audit request lifecycle
```

## Acceptance Criteria

```text
- Owner can request change.
- Locked data is not directly edited.
```

---

# Epic 10 — Team Invitation

## Tasks

```text
10.01 Owner invite form
10.02 Select role and expiry
10.03 Generate JOIN_BRAND key
10.04 Send email
10.05 Accept invite route
10.06 Create membership
10.07 Audit invite and accept
```

## Acceptance Criteria

```text
- Specialist can join via time-limited email-bound link.
- Specialist has limited permissions.
```

---

# Epic 11 — File System

## Tasks

```text
11.01 Setup Supabase Storage bucket
11.02 Create files table
11.03 Upload file component
11.04 Signed download URL action
11.05 File visibility handling
11.06 Specialist upload status
11.07 Owner approve/reject Specialist file
11.08 Audit upload/download
```

## Acceptance Criteria

```text
- Files are private.
- Download requires permission.
- Specialist upload requires approval.
```

---

# Epic 12 — Module Workflow

## Tasks

```text
12.01 Create brand_modules table
12.02 Create module_artifacts table
12.03 Seed default modules per brand
12.04 Admin module board
12.05 Internal Specialist upload DOCX/PDF
12.06 Supervisor review
12.07 Send to Client Review
12.08 Client view PDF
12.09 Client comment
12.10 Client approve/request change
```

## Acceptance Criteria

```text
- Supervisor gate exists before client review.
- Client approval does not trigger RAG.
```

---

# Epic 13 — RAG Approval Queue

## Tasks

```text
13.01 Create knowledge_files table
13.02 Create RAG Approval Queue page
13.03 Show CLIENT_APPROVED modules/files
13.04 Supervisor RAG approval
13.05 Platform Owner RAG approval
13.06 Set RAG_APPROVED
13.07 Audit approvals
```

## Acceptance Criteria

```text
- Only RAG_APPROVED files are eligible for sync.
```

---

# Epic 14 — OpenAI File Search Sync

## Tasks

```text
14.01 Create OpenAI utility
14.02 Create knowledge_bases table
14.03 Create vector store per brand
14.04 Upload RAG_APPROVED files
14.05 Store provider IDs
14.06 Show sync status
14.07 Handle failed sync
```

## Acceptance Criteria

```text
- Brand knowledge is isolated per brand.
- Non-approved files never sync.
```

---

# Epic 15 — Brand Integrator Brain

## Tasks

```text
15.01 Create Brand Brain page
15.02 Check Brain readiness
15.03 Build chat UI
15.04 Call OpenAI Responses API with file search
15.05 Store agent_runs
15.06 Show answer and sources if available
```

## Acceptance Criteria

```text
- Brain locked before RAG_SYNCED.
- Brain uses current brand only.
```

---

# Epic 16 — Agent Catalog & Activation

## Tasks

```text
16.01 Create agents table
16.02 Seed five agents + Brand Integrator Brain
16.03 Create agent_entitlements from plan
16.04 Show locked/available/active states
16.05 Owner activates available agent
16.06 Audit activation
```

---

# Epic 17 — Five MVP Agents

## Tasks

```text
17.01 Story Teller prompt and run flow
17.02 Image Generator prompt and run flow
17.03 Video Generator prompt and run flow
17.04 Campaign Maker prompt and run flow
17.05 Brand Digital Activation prompt and run flow
17.06 Agent run history
17.07 Usage tracking placeholder
```

---

# Epic 18 — QA & Hardening

## Tasks

```text
18.01 Permission tests
18.02 Access Key tests
18.03 Intake lock tests
18.04 File security tests
18.05 Module workflow tests
18.06 RAG isolation tests
18.07 Agent access tests
18.08 Audit coverage review
```

---

# Epic 19 — Deployment Preparation

## Tasks

```text
19.01 Dockerfile
19.02 docker-compose for app/worker optional
19.03 Nginx/Caddy config
19.04 .env.production checklist
19.05 Health endpoint
19.06 Backup checklist
19.07 Staging deployment
19.08 Production deployment
```
