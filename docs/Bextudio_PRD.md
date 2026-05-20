# Bextudio MVP — Product Requirements Document v0.1

## 1. خلاصه اجرایی

Bextudio MVP پلتفرمی است که مشتریان executive پس از Login، برند خود را با Access Key یا فعال‌سازی دستی Admin فعال می‌کنند، به سوال‌های اجباری پاسخ می‌دهند، پاسخ‌ها را قفل می‌کنند، خروجی‌های انسانی تیم Bextudio را review می‌کنند، و پس از approval داخلی، Brand Brain و Agentهای اختصاصی دریافت می‌کنند.

## 2. اهداف محصول

### اهداف تجاری

1. جایگزینی لینک GPT با لینک پلتفرم اختصاصی.
2. پشتیبانی از فروش online و manual/offline.
3. ایجاد workflow رسمی برای تولید خروجی‌های انسانی.
4. ایجاد مسیر امن برای RAG.
5. فعال‌سازی Agentها بر اساس plan.
6. ثبت audit برای تمام اکشن‌های حساس.

### اهداف مشتری

1. دسترسی به Dashboard امن.
2. تکمیل structured intake.
3. کنترل و approve خروجی‌ها.
4. مشاهده وضعیت فرآیند.
5. استفاده از Brand Brain و Agentها.

---

## 3. Scope

### In Scope

- Supabase Auth
- User profile
- Locked Dashboard
- Brand Access Key
- Admin-created brand
- Manual entitlement grant
- Strategic Brand Intake
- Final Submit + Lock
- Change Request
- Team invitation
- Secure file upload/download
- Module workflow
- Client review
- RAG approval queue
- OpenAI File Search sync
- Brand Integrator Brain
- ۵ Agent MVP
- Audit logs

### Out of Scope

- Public marketplace
- Agent builder
- Custom RAG
- AI Developer portal
- Advanced billing
- Advanced analytics
- 3D visual interface

---

## 4. User Stories

## 4.1 Registered User

### Story

به‌عنوان کاربر ثبت‌نام‌شده، می‌خواهم بعد از ورود بدانم برای فعال‌سازی برند چه کاری باید انجام دهم.

### Acceptance Criteria

- اگر access ندارم، Dashboard خاموش ببینم.
- فرم Access Key داشته باشم.
- CTA برای demo/contact ببینم.
- نتوانم سوال‌ها، فایل‌ها یا Agentها را ببینم.

---

## 4.2 Owner / Executive Manager

### Story

به‌عنوان Owner، می‌خواهم برندم را فعال کنم، سوال‌ها را کامل جواب بدهم، خروجی‌ها را تایید کنم و Agentهای برندم را فعال کنم.

### Acceptance Criteria

- بتوانم برند create یا claim کنم.
- بتوانم همه سوال‌ها را جواب بدهم.
- final submit فقط در completion 100% فعال شود.
- بعد از submit، جواب‌ها locked شوند.
- بتوانم change request بدهم.
- بتوانم specialist دعوت کنم.
- بتوانم moduleها را approve یا request change کنم.
- بتوانم Agentهای available را activate کنم.

---

## 4.3 Brand Specialist

### Story

به‌عنوان Specialist، می‌خواهم به برند دعوت شوم و بتوانم فایل یا اطلاعات پشتیبان ارسال کنم.

### Acceptance Criteria

- فقط با invite وارد شوم.
- بتوانم فایل upload کنم.
- فایل من pending owner approval شود.
- نتوانم final submit کنم.
- نتوانم module approve کنم.
- نتوانم Agent activate کنم.

---

## 4.4 Internal Specialist

### Story

به‌عنوان عضو تیم داخلی، می‌خواهم روی moduleهای assigned کار کنم و فایل draft upload کنم.

### Acceptance Criteria

- فقط moduleهای assigned را ببینم.
- بتوانم DOCX/PDF draft upload کنم.
- نتوانم مستقیم client review publish کنم.

---

## 4.5 Supervisor

### Story

به‌عنوان Supervisor، می‌خواهم خروجی‌های داخلی را کنترل کنم و فقط فایل‌های مناسب را برای client review بفرستم.

### Acceptance Criteria

- فایل‌های internal review را ببینم.
- بتوانم approve for client review کنم.
- بتوانم در RAG approval مشارکت کنم.

---

## 4.6 Platform Owner

### Story

به‌عنوان Platform Owner، می‌خواهم همه برندها، accessها، planها، RAG approvalها، Agentها و auditها را مدیریت کنم.

### Acceptance Criteria

- manual plan grant داشته باشم.
- access key بسازم.
- brand بسازم.
- RAG approve کنم.
- audit logs را ببینم.

---

## 5. Feature Requirements

## 5.1 Authentication

### Requirements

- Register
- Login
- Logout
- Protected routes
- Create users_profile on first login

### Tests

| ID | Test | Expected |
|---|---|---|
| AUTH-001 | Register | Supabase user created |
| AUTH-002 | Login | Redirect to Dashboard |
| AUTH-003 | No login dashboard access | Redirect to login |
| AUTH-004 | Logout | Session cleared |

---

## 5.2 Locked Dashboard

### Requirements

- Show inactive state if no active brand access.
- Show Access Key form.
- Hide intake/modules/agents.

### Tests

| ID | Test | Expected |
|---|---|---|
| DASH-001 | user without access | inactive dashboard |
| DASH-002 | access intake without brand | denied |
| DASH-003 | invalid key | error |

---

## 5.3 Access Key

### Requirements

- Types: CREATE_BRAND, CLAIM_BRAND, JOIN_BRAND, DEMO_ACCESS, SUPPORT_ACCESS.
- Store only hash.
- Email-bound.
- Expiring.
- Audit on create/redeem.

### Tests

| ID | Test | Expected |
|---|---|---|
| KEY-001 | create key | raw key shown once |
| KEY-002 | database check | raw key not stored |
| KEY-003 | redeem valid key | success |
| KEY-004 | redeem expired key | fail |
| KEY-005 | redeem wrong email | fail |
| KEY-006 | redeem twice | fail |

---

## 5.4 Brand Create / Claim

### Requirements

- CREATE_BRAND lets user create brand.
- CLAIM_BRAND connects user to existing brand.
- Owner membership created.
- Default intake session created.
- Default modules created based on plan.

### Tests

| ID | Test | Expected |
|---|---|---|
| BRAND-001 | create without key | fail |
| BRAND-002 | create with key | brand created |
| BRAND-003 | claim brand | membership created |
| BRAND-004 | claim wrong brand | fail |

---

## 5.5 Manual Entitlement

### Requirements

Admin can manually grant plan.

Fields:
- Brand
- Plan
- Source
- Start date
- Expiry date
- Note/reference

### Tests

| ID | Test | Expected |
|---|---|---|
| ENT-001 | manual grant | entitlement active |
| ENT-002 | grant creates agent entitlements | yes |
| ENT-003 | grant audit | audit log |
| ENT-004 | expired entitlement | access restricted |

---

## 5.6 Strategic Brand Intake

### Requirements

Sections:
1. Company
2. Consumer / Market Segmentation
3. User Persona
4. Products / Services
5. Context
6. Style / Tone of Voice

Rules:
- all required
- autosave
- progress
- final submit disabled before 100%

### Tests

| ID | Test | Expected |
|---|---|---|
| INT-001 | show sections | all 6 visible |
| INT-002 | answer question | autosaved |
| INT-003 | incomplete | submit disabled |
| INT-004 | complete | submit enabled |
| INT-005 | Specialist tries submit | denied |

---

## 5.7 Final Submit + Lock

### Requirements

- Confirmation modal
- Server-side validation
- Lock session
- Snapshot JSON
- Disable edit
- Notify internal team
- Audit

### Tests

| ID | Test | Expected |
|---|---|---|
| LOCK-001 | submit incomplete | fail |
| LOCK-002 | submit complete | locked |
| LOCK-003 | edit after lock | fail |
| LOCK-004 | snapshot exists | yes |

---

## 5.8 Change Request

### Requirements

- Can target section/question/module/file.
- Includes comment.
- Status workflow.
- Does not mutate snapshot directly.

### Tests

| ID | Test | Expected |
|---|---|---|
| CR-001 | owner creates request | REQUESTED |
| CR-002 | supervisor reviews | status updated |
| CR-003 | locked answer remains unchanged | yes |

---

## 5.9 Invitation

### Requirements

- Owner invites Specialist.
- Email-bound JOIN_BRAND key.
- Expiry required.
- Membership created after accept.

### Tests

| ID | Test | Expected |
|---|---|---|
| INV-001 | invite | email sent |
| INV-002 | accept valid invite | membership created |
| INV-003 | expired invite | fail |
| INV-004 | specialist permissions | restricted |

---

## 5.10 File System

### Requirements

- Private storage.
- Signed URLs.
- Visibility statuses.
- Specialist uploads pending Owner approval.
- Audit upload/download.

### Tests

| ID | Test | Expected |
|---|---|---|
| FILE-001 | upload | file metadata saved |
| FILE-002 | public URL access | fail |
| FILE-003 | signed URL | works temporarily |
| FILE-004 | specialist upload | pending |
| FILE-005 | owner approves | approved |

---

## 5.11 Module Workflow

### Requirements

- Internal Specialist uploads draft.
- Supervisor approves before client review.
- Client sees PDF preview.
- Client comments.
- Client approves or requests change.
- Client approval does not trigger RAG sync.

### Tests

| ID | Test | Expected |
|---|---|---|
| MOD-001 | internal upload | draft artifact |
| MOD-002 | internal publishes directly | fail |
| MOD-003 | supervisor approves | client review |
| MOD-004 | client approves | CLIENT_APPROVED |
| MOD-005 | client approval auto RAG | must not happen |

---

## 5.12 RAG Approval

### Requirements

- Client-approved files appear in RAG queue.
- Supervisor + Platform Owner approve.
- Only RAG_APPROVED syncs.

### Tests

| ID | Test | Expected |
|---|---|---|
| RAG-001 | client approved file | queue item |
| RAG-002 | sync without RAG approval | fail |
| RAG-003 | supervisor approves | partial |
| RAG-004 | platform owner approves | RAG_APPROVED |

---

## 5.13 OpenAI File Search Sync

### Requirements

- One vector store per brand.
- Only RAG_APPROVED files.
- Store provider ids.
- Show status.

### Tests

| ID | Test | Expected |
|---|---|---|
| OFS-001 | create vector store | id stored |
| OFS-002 | sync approved file | RAG_SYNCED |
| OFS-003 | sync non-approved | fail |
| OFS-004 | cross-brand retrieval | fail |

---

## 5.14 Brand Integrator Brain

### Requirements

- Locked before Brain Ready.
- Uses current brand vector store.
- Logs run.
- Shows answer.

### Tests

| ID | Test | Expected |
|---|---|---|
| BRAIN-001 | before sync | locked |
| BRAIN-002 | after sync | available |
| BRAIN-003 | ask question | answer |
| BRAIN-004 | run logged | yes |

---

## 5.15 Agents

### Requirements

Agents:
- Story Teller
- Image Generator
- Video Generator
- Campaign Maker
- Brand Digital Activation

Rules:
- plan-based
- Brain-ready required
- Owner activation
- run logs

### Tests

| ID | Test | Expected |
|---|---|---|
| AG-001 | plan excludes | locked |
| AG-002 | brain not ready | locked |
| AG-003 | owner activates | active |
| AG-004 | specialist activates | fail |
| AG-005 | run | logged |

---

## 6. Foldering

```text
bextudio-platform/
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   ├── (admin)/
│   └── api/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── dashboard/
│   ├── admin/
│   ├── forms/
│   ├── files/
│   ├── agents/
│   └── status/
├── features/
│   ├── auth/
│   ├── access/
│   ├── brands/
│   ├── entitlements/
│   ├── intake/
│   ├── change-requests/
│   ├── invitations/
│   ├── files/
│   ├── modules/
│   ├── rag/
│   ├── agents/
│   ├── audit/
│   └── notifications/
├── lib/
│   ├── supabase/
│   ├── permissions/
│   ├── audit/
│   ├── email/
│   ├── storage/
│   ├── openai/
│   ├── stripe/
│   └── utils/
├── types/
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── docs/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── Dockerfile
└── docker-compose.yml
```

---

## 7. Release Criteria

MVP release فقط وقتی مجاز است که:

- access key امن باشد.
- locked intake واقعاً edit نشود.
- فایل‌ها private باشند.
- RAG sync فقط approved files را بگیرد.
- Agentها cross-brand retrieval نداشته باشند.
- manual entitlement audit شود.
- role matrix تست شود.
