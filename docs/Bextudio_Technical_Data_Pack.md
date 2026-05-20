# Bextudio MVP — Technical Data Pack, Prompt Pack & Test Pack v0.1

## 1. Status Types

```ts
export type AccessKeyStatus = "ACTIVE" | "REDEEMED" | "EXPIRED" | "REVOKED";
export type AccessKeyType = "CREATE_BRAND" | "CLAIM_BRAND" | "JOIN_BRAND" | "DEMO_ACCESS" | "SUPPORT_ACCESS";
export type BrandRole = "OWNER" | "EXECUTIVE_MANAGER" | "BRAND_SPECIALIST";
export type InternalRole = "PLATFORM_OWNER" | "SUPERVISOR" | "INTERNAL_SPECIALIST";
export type EntitlementStatus = "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";
export type EntitlementSource = "STRIPE" | "MANUAL_CASH" | "BANK_TRANSFER" | "DEMO" | "PROMO" | "INTERNAL";
export type IntakeStatus = "DRAFT" | "IN_PROGRESS" | "REVIEW_READY" | "LOCKED";
export type ModuleStatus = "NOT_STARTED" | "ASSIGNED" | "IN_PROGRESS" | "INTERNAL_REVIEW" | "SUPERVISOR_APPROVED" | "CLIENT_REVIEW" | "CLIENT_APPROVED" | "CLIENT_CHANGE_REQUESTED" | "RAG_REVIEW_REQUIRED" | "RAG_APPROVED" | "RAG_SYNCED" | "LOCKED";
export type RagStatus = "NOT_ELIGIBLE" | "CLIENT_APPROVED" | "RAG_REVIEW_REQUIRED" | "RAG_APPROVED" | "SYNCING" | "RAG_SYNCED" | "SYNC_FAILED";
export type AgentEntitlementStatus = "LOCKED_BY_PLAN" | "LOCKED_BY_BRAIN" | "AVAILABLE" | "ACTIVE" | "SUSPENDED";
export type FileVisibility = "OWNER_ONLY" | "BRAND_TEAM" | "HELIO_INTERNAL" | "CLIENT_REVIEW" | "AGENT_VISIBLE";
export type FileStatus = "UPLOADED" | "PENDING_OWNER_APPROVAL" | "OWNER_APPROVED" | "OWNER_REJECTED" | "INTERNAL_DRAFT" | "SUPERVISOR_APPROVED" | "CLIENT_REVIEW" | "CLIENT_APPROVED" | "RAG_APPROVED" | "ARCHIVED";
```

---

## 2. Permission Functions

```ts
canViewDashboard(userId)
canRedeemAccessKey(userId, key)
canCreateBrand(userId, accessKeyId)
canClaimBrand(userId, brandId, accessKeyId)
canAnswerIntake(userId, brandId)
canFinalSubmitIntake(userId, brandId)
canCreateChangeRequest(userId, brandId)
canInviteBrandMember(userId, brandId)
canUploadBrandFile(userId, brandId)
canApproveSpecialistFile(userId, brandId)
canSendModuleToClient(userId, moduleId)
canClientApproveModule(userId, moduleId)
canApproveRag(userId, moduleId)
canSyncRag(userId, brandId)
canActivateAgent(userId, brandId, agentKey)
canRunAgent(userId, brandId, agentKey)
canGrantPlan(userId)
```

---

## 3. Core Business Functions

```ts
generateAccessKey()
redeemAccessKey({ rawKey, userId, userEmail })
grantBrandAccess({ brandId, planId, source, startsAt, expiresAt, grantedBy, note })
calculateIntakeCompletion(sessionId)
finalSubmitIntake({ brandId, sessionId, userId })
createChangeRequest({ brandId, targetType, targetId, comment, userId })
sendModuleToClientReview({ moduleId, supervisorId })
clientApproveModule({ moduleId, userId })
clientRequestModuleChange({ moduleId, userId, comment })
approveFileForRag({ knowledgeFileId, approverId, approverRole })
syncBrandKnowledgeBase({ brandId, triggeredBy })
activateAgent({ brandId, agentKey, userId })
runAgent({ brandId, agentKey, userId, input })
logAudit({ actorUserId, actorRole, brandId, action, entityType, entityId, before, after })
```

---

## 4. Database Tables

### Core

- users_profile
- brands
- brand_memberships
- access_keys
- plans
- brand_entitlements

### Intake

- question_sections
- questions
- intake_sessions
- intake_answers
- intake_snapshots
- change_requests

### Modules

- brand_modules
- module_artifacts
- module_reviews
- files

### RAG / Agents

- knowledge_bases
- knowledge_files
- agents
- agent_entitlements
- agent_runs

### System

- audit_logs
- notifications optional

---

## 5. Foldering

```text
bextudio-platform/
├── app/
│   ├── (auth)/login
│   ├── (auth)/register
│   ├── (auth)/access
│   ├── (dashboard)/dashboard
│   ├── (dashboard)/dashboard/intake
│   ├── (dashboard)/dashboard/modules
│   ├── (dashboard)/dashboard/agents
│   ├── (dashboard)/dashboard/team
│   ├── (admin)/admin
│   └── api/webhooks/stripe
├── components/
├── features/
├── lib/
├── types/
├── supabase/
├── docs/
├── tests/
├── Dockerfile
└── docker-compose.yml
```

### Feature folder pattern

```text
/features/access/
├── actions.ts
├── queries.ts
├── validators.ts
├── permissions.ts
├── types.ts
└── components/
```

---

## 6. Test Pack

## 6.1 Unit Tests

### Access Key

- generate key returns rawKey/hash/prefix.
- hash is not raw key.
- expired key validation fails.
- wrong email validation fails.

### Entitlement

- grantBrandAccess creates entitlement.
- grantBrandAccess creates agent entitlements.
- expired entitlement is inactive.

### Intake

- completion 0 when no answers.
- completion 100 when all required answered.
- final submit fails below 100.
- locked session cannot update answer.

### Permission

- owner can answer intake.
- specialist cannot final submit.
- supervisor can send module to client.
- internal specialist cannot send module to client.
- platform owner can grant plan.

---

## 6.2 Integration Tests

- user without access sees locked dashboard.
- CREATE_BRAND key creates brand and owner membership.
- CLAIM_BRAND key connects user to existing brand.
- JOIN_BRAND key creates specialist membership.
- owner answers all questions and locks intake.
- snapshot created after final submit.
- internal specialist uploads module draft.
- supervisor sends module to client.
- client approves module.
- client approval does not sync RAG.
- RAG approval enables sync.
- owner activates available agent.

---

## 6.3 E2E Tests

### E2E-001 Full Brand Creation

```text
Register → Login → Redeem CREATE_BRAND → Create brand → Active dashboard
```

### E2E-002 Full Intake

```text
Open intake → Answer all sections → Review → Final submit → Locked view
```

### E2E-003 Module Review

```text
Internal upload → Supervisor approve → Client review → Client approve
```

### E2E-004 RAG + Brain

```text
Client-approved module → RAG approval → Sync → Brain ready → Ask question
```

### E2E-005 Agent

```text
Brain ready → Activate Story Teller → Run → Log created
```

---

## 7. Prompt Pack

## 7.1 Master Prompt

```text
You are coding the Bextudio MVP.
Read and follow PROJECT_CONTEXT.md, PRD.md, TECHNICAL_DATA_PACK.md, SECURITY_RULES.md.
Build only the requested feature.
Do not invent product logic.
Do not bypass permissions.
Do not expose private files.
Do not allow locked intake answers to be edited.
Do not allow client approval to trigger RAG sync.
Every sensitive action must create an audit log.
Output: files changed, summary, security notes, manual test steps, assumptions.
```

## 7.2 Prompt: Supabase Schema

```text
Create the initial Supabase SQL schema for Bextudio MVP.
Tables: users_profile, brands, brand_memberships, access_keys, plans, brand_entitlements, question_sections, questions, intake_sessions, intake_answers, intake_snapshots, change_requests, brand_modules, module_artifacts, module_reviews, files, knowledge_bases, knowledge_files, agents, agent_entitlements, agent_runs, audit_logs.
Use uuid primary keys, created_at timestamps, indexes on brand_id/user_id/status/email.
Never store raw access keys.
Prepare for RLS later.
```

## 7.3 Prompt: Auth

```text
Implement Supabase Auth in Next.js.
Create login, register, logout, protected dashboard.
Create users_profile on first login.
User without brand access sees inactive Dashboard.
Do not use auth user as brand permission; use brand_memberships.
```

## 7.4 Prompt: Access Key

```text
Implement Brand Access Key system.
Types: CREATE_BRAND, CLAIM_BRAND, JOIN_BRAND, DEMO_ACCESS, SUPPORT_ACCESS.
Generate secure random key, store only hash, use prefix for display, validate expiry and email, create audit logs.
```

## 7.5 Prompt: Manual Entitlement

```text
Build Manual Plan Grant.
Admin selects brand, plan, source, start, expiry, note.
Call grantBrandAccess. Create entitlement, agent_entitlements, audit log.
```

## 7.6 Prompt: Intake

```text
Build Strategic Brand Intake with six sections.
All questions required, autosave, progress, final submit disabled until 100%.
Owner can edit before lock; Specialist cannot final submit.
```

## 7.7 Prompt: Lock

```text
Implement Final Submit and Intake Lock.
Show confirmation modal, validate completion, set LOCKED, set locked_at/locked_by, create snapshot_json, prevent edits, audit, notify internal team.
```

## 7.8 Prompt: Module Workflow

```text
Build Module Workflow.
Internal Specialist uploads DOCX/PDF. Supervisor approves for client review. Client views PDF, comments, approves or requests change. Client approval must not trigger RAG sync.
```

## 7.9 Prompt: RAG Approval

```text
Build RAG Approval Queue.
Show client-approved files. Supervisor approval + Platform Owner approval required. Only then RAG_APPROVED. Audit all approvals.
```

## 7.10 Prompt: OpenAI File Search

```text
Implement OpenAI File Search sync.
One vector store per brand. Upload only RAG_APPROVED files. Store provider IDs. Show status. Prevent cross-brand sync.
```

## 7.11 Prompt: Brand Brain

```text
Build Brand Integrator Brain chat.
Available only when Brain ready. Use current brand vector store. Call Responses API with File Search. Log run. Never use other brand data.
```

## 7.12 Prompt: Agents

```text
Build Agent Catalog and activation.
Agents: Story Teller, Image Generator, Video Generator, Campaign Maker, Brand Digital Activation.
Plan-based availability, locked before Brain ready, Owner activation, Specialist denied, runs logged.
```

---

## 8. Build Order

1. Project setup
2. Supabase schema
3. Auth
4. Locked Dashboard
5. Admin foundation
6. Plans
7. Manual entitlement
8. Access Key
9. Brand create/claim
10. Strategic Intake
11. Final Submit Lock
12. Change Requests
13. Invitations
14. File System
15. Module Workflow
16. RAG Approval Queue
17. OpenAI File Search Sync
18. Brand Integrator Brain
19. Agent Catalog
20. Five MVP Agents
21. Audit hardening
22. Permission tests
23. Deployment prep

---

## 9. Security Rules File Content

Create `/docs/SECURITY_RULES.md` with:

```text
1. Login is not access.
2. Access Key is not auth token.
3. Brand access requires membership + entitlement.
4. Every query must be scoped by brand_id.
5. Raw access keys must never be stored.
6. Files must be private.
7. File downloads require signed URLs.
8. Locked intake cannot be edited.
9. Change Request never directly mutates snapshot.
10. Client Approval does not trigger RAG sync.
11. RAG sync only uses RAG_APPROVED files.
12. Specialist cannot final submit.
13. Specialist cannot approve modules.
14. Internal Specialist cannot publish to client.
15. Admin actions must be audited.
16. Demo access must expire.
17. No service role key in client code.
18. No production secrets in prompts.
```

---

## 10. Definition of Done

A feature is done only if:

- UI exists.
- Server-side validation exists.
- Permission checks exist.
- Audit log exists for sensitive actions.
- Loading/error states exist.
- Manual test steps pass.
- Docs updated.
- No unrelated feature added.
