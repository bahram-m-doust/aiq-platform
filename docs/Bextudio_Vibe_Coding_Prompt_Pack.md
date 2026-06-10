# Bextudio MVP — Vibe Coding Prompt Pack v0.1

## 1. Master Prompt

Use this at the beginning of a coding session:

```text
You are a senior full-stack engineer building the Bextudio Platform MVP.

Read and follow these files as source of truth:
- docs/Bextudio_Project_Overview.md
- docs/Bextudio_PRD.md
- docs/Bextudio_Roles_Permissions.md
- docs/Bextudio_Security_Rules.md
- docs/Bextudio_Database_Schema.md
- docs/Bextudio_Task_Breakdown.md
- docs/Bextudio_Folder_Structure.md

Core stack:
- Next.js App Router
- TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- OpenAI Responses API + File Search later

Product rules:
- Login is not access.
- Access requires membership + entitlement.
- Brand Access Keys must be hashed and time-limited.
- Files must not be public.
- Locked intake answers cannot be edited directly.
- Client Approval is not RAG Approval.
- Only RAG_APPROVED files can enter Brand Brain.
- All sensitive actions must create audit logs.

Your task is to build only the feature I specify.
Do not create unrelated features.
Do not invent new business logic.
Before coding, summarize what you will build and which files you will touch.
After coding, provide manual test steps.
```

---

## 2. Prompt Template for Every Task

```text
Task:
[write task name from Bextudio_Task_Breakdown.md]

Context:
Use docs as source of truth. Build only this feature.

Requirements:
[paste requirements]

Security Rules:
- Check permissions server-side.
- Scope all brand data by brand_id.
- Create audit logs for sensitive actions.
- Never expose service role key to client.

Output:
1. Files changed
2. Code implemented
3. Explanation
4. Manual test steps
5. Any assumptions
```

---

## 3. Prompt — Initialize Project Structure

```text
Task:
Initialize the Bextudio MVP project structure.

Requirements:
- Create folder structure according to docs/Bextudio_Folder_Structure.md.
- Use Next.js App Router and TypeScript.
- Create /features folders for auth, access, brands, intake, modules, files, rag, agents, admin, audit.
- Create /lib folders for supabase, permissions, audit, email, security, constants, utils.
- Create placeholder README files where needed.
- Do not implement business logic yet.

Output:
- Folder tree
- Files created
- Next steps
```

---

## 4. Prompt — Supabase Schema Migration

```text
Task:
Create Supabase SQL migration for Bextudio MVP schema.

Requirements:
- Use docs/Bextudio_Database_Schema.md as source of truth.
- Create tables:
  users_profile, brands, brand_memberships, access_keys, plans, brand_entitlements, question_sections, questions, intake_sessions, intake_answers, intake_snapshots, change_requests, brand_modules, module_artifacts, module_reviews, files, knowledge_bases, knowledge_files, agents, agent_entitlements, agent_runs, audit_logs.
- Use uuid primary keys.
- Add created_at.
- Add indexes for brand_id, user_id, status.
- Do not implement RLS yet.
- Do not store raw access keys.

Output:
- supabase/migrations/0001_initial_schema.sql
- Explanation of relationships
```

---

## 5. Prompt — Seed Plans, Sections, Agents

```text
Task:
Create seed SQL for plans, intake sections, module types if needed, and agents.

Plans:
- BASIC
- ADVANCED
- ENTERPRISE

Intake Sections:
1. Company
2. Consumer / Market Segmentation
3. User Persona
4. Products / Services
5. Context
6. Style / Tone of Voice

Agents:
- BRAND_INTEGRATOR_BRAIN
- STORY_TELLER
- IMAGE_GENERATOR
- VIDEO_GENERATOR
- CAMPAIGN_MAKER
- BRAND_DIGITAL_ACTIVATION

Requirements:
- Create idempotent seed script if possible.
- Do not add fake business data.

Output:
- supabase/seeds/plans.sql
- supabase/seeds/questions_sections.sql
- supabase/seeds/agents.sql
```

---

## 6. Prompt — Supabase Auth

```text
Task:
Implement Supabase Auth for Bextudio MVP.

Requirements:
- Create login page.
- Create register page.
- Create logout action.
- Create users_profile on first login.
- Protect /home and /admin routes.
- Redirect logged-in user to /home.
- User without access sees inactive Dashboard.

Security:
- Supabase Auth identifies user only.
- Permissions come from brand_memberships and entitlements.
- Do not expose service role key to client.

Output:
- Files changed
- Manual test steps
```

---

## 7. Prompt — Locked Dashboard

```text
Task:
Build inactive Dashboard state for authenticated users without active brand access.

Requirements:
- Route: /home
- Show formal executive copy.
- Include Access Key form placeholder.
- Include Request Demo Access CTA.
- Include Contact Bextudio CTA.
- Do not show intake/modules/agents.

Suggested copy:
"Your strategic workspace is ready, but not yet activated. Activate access to begin the Brand Intelligence process and start building your Brand Brain."

Output:
- Dashboard page
- Components
- Data fetching logic
- Manual test steps
```

---

## 8. Prompt — Access Key Service

```text
Task:
Build Brand Access Key service.

Access Key types:
- CREATE_BRAND
- CLAIM_BRAND
- JOIN_BRAND
- DEMO_ACCESS
- SUPPORT_ACCESS

Requirements:
- Generate secure random key.
- Store only hash.
- Store key_prefix.
- Validate status, expiry, target_email, redemption count.
- Implement redeemAccessKey function.
- Create audit log for redemption.
- Return next action after redemption.

Security:
- Never store raw key.
- Never log raw key.
- Never expose hash to client.

Output:
- lib/security/generateAccessKey.ts
- lib/security/hashAccessKey.ts
- features/access/services.ts
- features/access/actions.ts
- Manual tests
```

---

## 9. Prompt — Admin Create Access Key

```text
Task:
Build Admin UI to create and send Brand Access Keys.

Requirements:
- Admin can choose type: CREATE_BRAND, CLAIM_BRAND, JOIN_BRAND, DEMO_ACCESS.
- Admin can set target_email.
- Admin can set target_brand_id if needed.
- Admin can set target_role.
- Admin can set plan for CREATE_BRAND/DEMO.
- Admin can set expiry date.
- Show raw key only once after creation.
- Optionally send key by email.
- Audit key creation.

Output:
- Admin page
- Form component
- Server action
- Manual test steps
```

---

## 10. Prompt — Manual Plan Grant

```text
Task:
Build Manual Plan Grant feature.

Requirements:
- Admin selects brand.
- Admin selects plan.
- Admin selects source: MANUAL_CASH, BANK_TRANSFER, DEMO, PROMO, INTERNAL.
- Admin sets starts_at and expires_at.
- Admin enters reference/note.
- Call shared grantBrandAccess function.
- Create brand_entitlement.
- Create agent_entitlements based on plan.
- Audit action.

Important:
Stripe webhook later must also call grantBrandAccess.

Output:
- features/admin/manual-grant components/actions
- grantBrandAccess service
- Manual test steps
```

---

## 11. Prompt — Create Brand With Access Key

```text
Task:
Implement CREATE_BRAND flow.

Requirements:
- User redeems valid CREATE_BRAND key.
- User fills brand name, industry, website optional.
- System creates brand.
- System creates brand_membership with role OWNER.
- System creates intake_session.
- System creates default brand_modules based on plan.
- System creates entitlement if key includes plan.
- Audit brand creation.

Output:
- Create brand page
- Server action
- Validation
- Manual test steps
```

---

## 12. Prompt — Claim Brand

```text
Task:
Implement CLAIM_BRAND flow.

Requirements:
- Admin has created brand.
- User redeems CLAIM_BRAND key.
- System validates target_brand_id and target_email.
- System creates Owner membership.
- Dashboard becomes active.
- Audit brand claim.

Output:
- Claim flow
- Server action
- Manual test steps
```

---

## 13. Prompt — Strategic Brand Intake

```text
Task:
Build Strategic Brand Intake.

Sections:
1. Company
2. Consumer / Market Segmentation
3. User Persona
4. Products / Services
5. Context
6. Style / Tone of Voice

Requirements:
- Render sections from DB.
- Render questions from DB.
- All questions required.
- Autosave answers.
- Show progress per section and total.
- Final Submit disabled until 100%.
- Only Owner/Executive Manager can answer.
- Use formal executive tone.

Output:
- Intake pages
- QuestionRenderer component
- Autosave action
- Completion function
- Manual test steps
```

---

## 14. Prompt — Final Submit & Lock

```text
Task:
Implement final submit and lock.

Requirements:
- Show confirmation modal.
- Validate completion = 100%.
- Set intake status LOCKED.
- Set locked_at and locked_by.
- Create intake_snapshot with snapshot_json.
- Disable further editing server-side.
- Create audit log.
- Create internal notification placeholder.

Copy:
"Final submission will lock your answers and initiate the strategic development process. After this point, direct editing will be disabled. Any required correction must be submitted as a Change Request."

Output:
- Final submit modal
- Server action
- Locked view
- Manual test steps
```

---

## 15. Prompt — Change Requests

```text
Task:
Build Change Request system.

Requirements:
- Owner can create request for locked intake section/question.
- Owner can create request for module.
- Include comment and reason.
- Statuses: REQUESTED, UNDER_REVIEW, APPROVED, REJECTED, APPLIED, CLOSED.
- Admin/Supervisor can review.
- Do not directly edit locked answers.
- Audit all actions.

Output:
- Client form
- Admin review page
- Server actions
- Manual tests
```

---

## 16. Prompt — Team Invitations

```text
Task:
Build Brand Specialist invitation flow.

Requirements:
- Owner can invite Specialist by email.
- Owner sets expiry.
- System creates JOIN_BRAND Access Key.
- Email sends invitation link.
- Invite is email-bound.
- User accepts after login/register.
- Membership created with BRAND_SPECIALIST role.
- Audit invite and accept.

Output:
- Invite form
- Accept invite route
- Email template
- Manual tests
```

---

## 17. Prompt — Secure File Upload

```text
Task:
Build secure file upload/download.

Requirements:
- Use Supabase Storage private bucket.
- Store metadata in files table.
- Use signed URLs for download.
- File visibility: OWNER_ONLY, BRAND_TEAM, HELIO_INTERNAL, CLIENT_REVIEW, AGENT_VISIBLE.
- Specialist uploads get PENDING_OWNER_APPROVAL.
- Owner can approve/reject Specialist file.
- Audit upload/download.

Output:
- FileUploader component
- Signed download action
- Approval actions
- Manual tests
```

---

## 18. Prompt — Module Workflow

```text
Task:
Build Brand Module workflow.

Module types:
- Brand Knowledge
- Archetype
- Market Intelligence
- Research Benchmark
- Brand City Canvas
- City Experience Strategies
- Language Style
- Visual System
- Touchpoint System
- Brand Integrator Brain Pack

Requirements:
- Admin module board.
- Internal Specialist uploads DOCX/PDF.
- Supervisor approves for client review.
- Client sees PDF preview.
- Client comments.
- Client approves or requests change.
- Client approval does not trigger RAG sync.

Output:
- Module board
- Module detail page
- Client review page
- Status workflow
- Manual tests
```

---

## 19. Prompt — RAG Approval Queue

```text
Task:
Build RAG Approval Queue.

Requirements:
- Show CLIENT_APPROVED modules/files.
- Supervisor can approve for RAG.
- Platform Owner can final approve for RAG.
- When policy is satisfied, set RAG_APPROVED.
- Audit all approvals.
- Only RAG_APPROVED files are eligible for sync.

Output:
- Admin RAG page
- Approval actions
- Manual tests
```

---

## 20. Prompt — OpenAI File Search Sync

```text
Task:
Implement OpenAI File Search sync for MVP.

Requirements:
- Each brand gets its own vector store.
- Store provider_vector_store_id.
- Upload only RAG_APPROVED files.
- Store provider_file_id.
- Show sync statuses: SYNCING, RAG_SYNCED, SYNC_FAILED.
- Never sync files from another brand.
- Never sync non-approved files.

Output:
- features/rag/openai.ts
- sync action
- Admin sync UI
- Error handling
- Manual tests
```

---

## 21. Prompt — Brand Integrator Brain

```text
Task:
Build Brand Integrator Brain chat.

Requirements:
- Available only when Brand Brain is ready.
- Use OpenAI Responses API with brand vector store.
- Use only current brand knowledge base.
- Store run in agent_runs.
- Show answer in chat UI.
- Show locked state if Brain is not ready.

Output:
- Brain page
- Chat component
- Server action
- Agent run logging
- Manual tests
```

---

## 22. Prompt — Agent Catalog & Activation

```text
Task:
Build Agent Catalog and Activation.

Agents:
- Story Teller
- Image Generator
- Video Generator
- Campaign Maker
- Brand Digital Activation

Requirements:
- Seed agents.
- Show locked/available/active state.
- Availability depends on plan and Brain readiness.
- Owner can activate available agents.
- Specialist cannot activate.
- Audit activation.

Output:
- Agent list
- Agent detail
- Activation action
- Manual tests
```

---

## 23. Prompt — Agent Run Flow

```text
Task:
Implement run flow for the five MVP agents.

Requirements:
- Each agent has own system prompt.
- Each agent uses mapped knowledge modules.
- Calls OpenAI Responses API with brand vector store.
- Stores input/output in agent_runs.
- Enforces permission and entitlement.
- Uses formal, strategic tone.

Output:
- Agent prompts
- Run action
- Chat/input UI
- Agent run history
- Manual tests
```

---

## 24. Prompt — Audit Log Integration

```text
Task:
Implement centralized audit logging.

Requirements:
- Create logAudit utility.
- Add audit logs to sensitive actions.
- Admin can view audit logs.
- Logs are read-only in UI.
- Include actor, action, entity, brand, before/after where possible.

Sensitive actions:
- access key created/redeemed
- brand created/claimed
- plan granted
- intake answer updated
- intake final submitted
- file uploaded/downloaded
- module sent to client
- module approved
- RAG approved
- agent activated/run

Output:
- logAudit utility
- Admin audit page
- Integration examples
```
