# Bextudio MVP — Folder Structure & Code Organization v0.1

## 1. هدف سند

این سند ساختار پیشنهادی فولدرها را برای پروژه‌ی **Next.js + TypeScript + Supabase** تعریف می‌کند. هدف این است که پروژه برای Vibe Coding قابل کنترل بماند، featureها پراکنده نشوند، و AI Coding Tool هر بار بداند کد باید کجا ساخته شود.

## 2. اصل معماری فولدرها

```text
Feature-first, not file-type-first.
```

یعنی به‌جای اینکه همه چیز را فقط در `components`, `utils`, `api` بریزیم، هر domain اصلی باید فولدر خودش را داشته باشد:

```text
auth
access
brands
intake
modules
files
rag
agents
admin
audit
```

## 3. ساختار ریشه پروژه

```text
bextudio-platform/
├── app/
├── components/
├── features/
├── lib/
├── data/
├── docs/
├── scripts/
├── tests/
├── supabase/
├── public/
├── middleware.ts
├── next.config.ts
├── package.json
├── tsconfig.json
└── .env.example
```

## 4. ساختار App Router

```text
app/
├── layout.tsx
├── page.tsx
├── globals.css
│
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   ├── register/
│   │   └── page.tsx
│   ├── forgot-password/
│   │   └── page.tsx
│   └── callback/
│       └── route.ts
│
├── (dashboard)/
│   ├── dashboard/
│   │   ├── page.tsx
│   │   ├── loading.tsx
│   │   └── error.tsx
│   ├── intake/
│   │   ├── page.tsx
│   │   ├── review/
│   │   │   └── page.tsx
│   │   └── [sectionKey]/
│   │       └── page.tsx
│   ├── modules/
│   │   ├── page.tsx
│   │   └── [moduleId]/
│   │       └── page.tsx
│   ├── agents/
│   │   ├── page.tsx
│   │   └── [agentKey]/
│   │       └── page.tsx
│   ├── team/
│   │   └── page.tsx
│   └── settings/
│       └── page.tsx
│
├── admin/
│   ├── page.tsx
│   ├── brands/
│   │   ├── page.tsx
│   │   └── [brandId]/
│   │       └── page.tsx
│   ├── users/
│   │   └── page.tsx
│   ├── plans/
│   │   └── page.tsx
│   ├── entitlements/
│   │   └── page.tsx
│   ├── access-keys/
│   │   └── page.tsx
│   ├── intake/
│   │   └── page.tsx
│   ├── modules/
│   │   ├── page.tsx
│   │   └── [moduleId]/
│   │       └── page.tsx
│   ├── rag/
│   │   └── page.tsx
│   ├── agents/
│   │   └── page.tsx
│   └── audit/
│       └── page.tsx
│
└── api/
    ├── stripe/
    │   └── webhook/
    │       └── route.ts
    └── health/
        └── route.ts
```

## 5. فولدر features

هر feature باید UI، action، query، type و validation خودش را داشته باشد.

```text
features/
├── auth/
│   ├── components/
│   ├── actions.ts
│   ├── queries.ts
│   ├── schemas.ts
│   └── types.ts
│
├── access/
│   ├── components/
│   │   ├── AccessKeyForm.tsx
│   │   └── AccessStatusCard.tsx
│   ├── actions.ts
│   ├── queries.ts
│   ├── schemas.ts
│   ├── services.ts
│   └── types.ts
│
├── brands/
│   ├── components/
│   │   ├── BrandCreateForm.tsx
│   │   ├── BrandStatusCard.tsx
│   │   └── BrandHeader.tsx
│   ├── actions.ts
│   ├── queries.ts
│   ├── services.ts
│   └── types.ts
│
├── intake/
│   ├── components/
│   │   ├── IntakeProgress.tsx
│   │   ├── SectionNav.tsx
│   │   ├── QuestionRenderer.tsx
│   │   ├── FinalSubmitModal.tsx
│   │   └── LockedIntakeNotice.tsx
│   ├── actions.ts
│   ├── queries.ts
│   ├── schemas.ts
│   ├── services.ts
│   └── types.ts
│
├── modules/
│   ├── components/
│   │   ├── ModuleBoard.tsx
│   │   ├── ModuleStatusBadge.tsx
│   │   ├── ModuleUploadForm.tsx
│   │   ├── ClientReviewPanel.tsx
│   │   └── ModuleComments.tsx
│   ├── actions.ts
│   ├── queries.ts
│   ├── services.ts
│   └── types.ts
│
├── files/
│   ├── components/
│   │   ├── FileUploader.tsx
│   │   ├── FileList.tsx
│   │   └── FileAccessBadge.tsx
│   ├── actions.ts
│   ├── queries.ts
│   ├── storage.ts
│   └── types.ts
│
├── rag/
│   ├── components/
│   │   ├── RagApprovalQueue.tsx
│   │   ├── RagStatusBadge.tsx
│   │   └── SyncButton.tsx
│   ├── actions.ts
│   ├── openai.ts
│   ├── services.ts
│   └── types.ts
│
├── agents/
│   ├── components/
│   │   ├── AgentCard.tsx
│   │   ├── AgentChat.tsx
│   │   └── AgentRunHistory.tsx
│   ├── actions.ts
│   ├── prompts.ts
│   ├── services.ts
│   └── types.ts
│
├── admin/
│   ├── components/
│   ├── actions.ts
│   ├── queries.ts
│   └── types.ts
│
└── audit/
    ├── actions.ts
    ├── queries.ts
    ├── services.ts
    └── types.ts
```

## 6. فولدر lib

```text
lib/
├── supabase/
│   ├── client.ts
│   ├── server.ts
│   ├── admin.ts
│   └── middleware.ts
│
├── permissions/
│   ├── can.ts
│   ├── roles.ts
│   └── policies.ts
│
├── audit/
│   └── logAudit.ts
│
├── email/
│   ├── sendEmail.ts
│   └── templates.ts
│
├── security/
│   ├── hashAccessKey.ts
│   ├── generateAccessKey.ts
│   └── rateLimit.ts
│
├── constants/
│   ├── statuses.ts
│   ├── plans.ts
│   └── modules.ts
│
└── utils/
    ├── dates.ts
    ├── format.ts
    └── errors.ts
```

## 7. Supabase Folder

```text
supabase/
├── migrations/
│   ├── 0001_initial_schema.sql
│   ├── 0002_seed_plans.sql
│   ├── 0003_seed_questions.sql
│   └── 0004_seed_agents.sql
│
├── seeds/
│   ├── plans.sql
│   ├── questions.sql
│   └── agents.sql
│
└── rls/
    ├── brands.sql
    ├── files.sql
    ├── intake.sql
    └── modules.sql
```

## 8. Tests Folder

```text
tests/
├── unit/
│   ├── permissions.test.ts
│   ├── access-key.test.ts
│   ├── intake-completion.test.ts
│   └── rag-eligibility.test.ts
│
├── integration/
│   ├── redeem-access-key.test.ts
│   ├── final-submit-lock.test.ts
│   ├── module-review.test.ts
│   └── rag-sync.test.ts
│
├── e2e/
│   ├── auth.spec.ts
│   ├── locked-dashboard.spec.ts
│   ├── intake-flow.spec.ts
│   ├── admin-manual-grant.spec.ts
│   └── module-client-review.spec.ts
│
└── fixtures/
    ├── users.ts
    ├── brands.ts
    ├── accessKeys.ts
    └── questions.ts
```

## 9. Naming Rules

```text
Components: PascalCase
Example: StrategicIntakeForm.tsx

Server actions: verbNoun
Example: submitIntake.ts, grantBrandAccess.ts

Queries: getNoun
Example: getBrandDashboard.ts

Services: domainService
Example: accessKeyService.ts

Types: PascalCase
Example: BrandRole, ModuleStatus

Database tables: snake_case plural
Example: brand_memberships

Database enum-like text values: UPPER_SNAKE_CASE
Example: RAG_APPROVED
```

## 10. Anti-Patternها

```text
Don't put all actions in one actions.ts at root.
Don't put all components in one components folder without domain grouping.
Don't allow client-side permission as final source of truth.
Don't call Supabase service role from client code.
Don't use public file URLs.
Don't create features outside current epic.
```
