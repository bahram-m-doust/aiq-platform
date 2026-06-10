# Bextudio MVP — Platform Setup Guide v0.1

## 1. هدف سند

این سند آموزش می‌دهد بیرون از codebase چه کارهایی باید انجام دهی تا MVP آماده شود:

- Supabase setup
- OpenAI setup
- Stripe setup
- Email setup
- Storage setup
- Server deployment
- DNS/SSL
- Environment variables
- Testing setup
- Foldering

---

## 2. سرویس‌های MVP

| سرویس | استفاده |
|---|---|
| Supabase | Auth, Postgres, Storage |
| OpenAI | Responses API + File Search |
| Stripe | پرداخت آنلاین |
| Resend یا SMTP | ایمیل access/invite/notification |
| Server شرکت | deploy Next.js app |
| Nginx/Caddy | reverse proxy + SSL |
| R2/MinIO | optional file storage later |

---

# 3. Supabase Setup

## 3.1 ساخت Project

1. وارد Supabase Dashboard شو.
2. New Project بساز.
3. نام پیشنهادی:

```text
bextudio-mvp
```

4. region نزدیک به سرور یا مشتری انتخاب کن.
5. database password را در password manager ذخیره کن.

## 3.2 کلیدهای لازم

از Project Settings بگیر:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

قانون امنیتی:

```text
SUPABASE_SERVICE_ROLE_KEY هرگز نباید در browser/client استفاده شود.
```

## 3.3 Auth

در Supabase:

```text
Authentication → Providers → Email
```

فعال کن:

- Email/password
- Email confirmation برای production

Redirect URLs:

```text
http://localhost:3000/**
https://app.helio.ae/**
https://admin.helio.ae/**
```

Site URL:

```text
https://app.helio.ae
```

## 3.4 Auth Templates

Templateها را formal کن:

### Confirm signup

Subject:

```text
Confirm your Bextudio account
```

Body:

```text
Your Bextudio account has been created.
Confirm your email to continue to your secure brand workspace.
```

## 3.5 Database

در پروژه، migration داشته باش:

```text
/supabase/migrations/001_initial_schema.sql
```

Tables:

- users_profile
- brands
- brand_memberships
- access_keys
- plans
- brand_entitlements
- question_sections
- questions
- intake_sessions
- intake_answers
- intake_snapshots
- change_requests
- brand_modules
- module_artifacts
- module_reviews
- files
- knowledge_bases
- knowledge_files
- agents
- agent_entitlements
- agent_runs
- audit_logs

## 3.6 Storage Buckets

Buckets:

```text
brand-files
module-artifacts
client-previews
system-exports
```

همه private باشند.

Path pattern:

```text
brand-files/{brand_id}/{file_id}/{original_name}
module-artifacts/{brand_id}/{module_id}/{version}/{artifact_type}/{file_name}
client-previews/{brand_id}/{module_id}/{version}/{file_name}
system-exports/{brand_id}/intake-snapshots/{snapshot_id}.docx
```

## 3.7 RLS Strategy

برای MVP، logic permissions را server-side پیاده کن، اما RLS را از ابتدا plan کن.

Critical tables for RLS:

- brands
- brand_memberships
- files
- intake_sessions
- intake_answers
- brand_modules
- agent_runs

Rule concept:

```sql
exists (
  select 1
  from brand_memberships bm
  where bm.brand_id = target.brand_id
  and bm.user_id = auth.uid()
  and bm.status = 'ACTIVE'
)
```

## 3.8 Seed Data

Seed کن:

### Plans

- Basic
- Advanced
- Enterprise

### Agents

- Brand Integrator Brain
- Story Teller
- Image Generator
- Video Generator
- Campaign Maker
- Brand Digital Activation

### Sections

- Company
- Consumer / Market Segmentation
- User Persona
- Products / Services
- Context
- Style / Tone of Voice

### Modules

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

---

# 4. OpenRouter Setup

## 4.1 API Key

1. OpenRouter dashboard برو.
2. Project بساز.
3. API key بساز.
4. در env بگذار:

```text
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openai/gpt-4o-mini
```

## 4.2 Knowledge Retrieval Strategy

MVP:

```text
One pgvector knowledge base per brand.
Only RAG_APPROVED files are extracted, chunked, and embedded.
```

DB mapping:

```text
knowledge_bases.status
knowledge_files.rag_status
knowledge_chunks.embedding
```

## 4.3 Sync Flow

```text
RAG_APPROVED files
→ securely extract text
→ split content into bounded chunks
→ generate embeddings through OpenRouter
→ transactionally replace pgvector chunks
→ mark RAG_SYNCED
```

## 4.4 Agent Run Flow

```text
User prompt
→ permission check
→ agent entitlement check
→ retrieve current-brand pgvector context
→ call the bounded OpenRouter model
→ store agent_run
→ return response
```

## 4.5 AI Security

- هیچ فایل non-approved وارد RAG نشود.
- retrieval همیشه با brand_id فعلی فیلتر شود.
- محتوای بازیابی‌شده untrusted data است و نباید system prompt شود.
- هر run log شود.
- بودجه قبل از فراخوانی provider به‌صورت اتمیک reserve شود.
- هزینه واقعی provider در صورت وجود ثبت شود.

---

# 5. Access Grant Setup

Stripe در MVP فعلی پیاده‌سازی نشده و env یا webhook آن نباید تنظیم شود.
دسترسی از access key، demo approval یا manual grant ایجاد می‌شود و همه‌ی
مسیرها باید از سرویس idempotent مشترک استفاده کنند:

```text
grantBrandAccess()
```

---

# 6. Email Setup

## 6.1 Provider

انتخاب MVP:

- Resend اگر سرویس آماده می‌خواهی.
- SMTP شرکت اگر زیرساخت ایمیل قوی دارید.

Env:

```text
RESEND_API_KEY
EMAIL_FROM
```

یا SMTP:

```text
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
EMAIL_FROM
```

## 6.2 Domain

پیشنهاد:

```text
no-reply@helio.ae
```

یا:

```text
no-reply@platform.helio.ae
```

DNS records:

- SPF
- DKIM
- DMARC recommended

## 6.3 Templates

### Access Key

Subject:

```text
Your Bextudio Brand Access Key
```

### Specialist Invite

Subject:

```text
You have been invited to a Bextudio Brand Workspace
```

### Module Review

Subject:

```text
A strategic module is ready for your review
```

### Brain Ready

Subject:

```text
Your Brand Brain is ready
```

---

# 7. Company Server Deployment

## 7.1 Recommended Structure

```text
Company Server
├── Nginx or Caddy
├── Next.js app container
├── optional worker container
├── optional Redis
└── optional MinIO
```

Supabase خارجی باقی می‌ماند.

## 7.2 Docker Files

Need:

- Dockerfile
- docker-compose.yml
- .env.production

## 7.3 Reverse Proxy

Routes:

```text
app.helio.ae → localhost:3000
admin.helio.ae → localhost:3000/admin
```

یا اگر admin جدا شد:

```text
admin.helio.ae → localhost:3001
```

SSL با Let's Encrypt.

## 7.4 Env Variables

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
KEY_ENCRYPTION_KEY
KEY_ENCRYPTION_ACTIVE_KEY_ID
OPENROUTER_API_KEY
OPENROUTER_MODEL
RESEND_API_KEY
EMAIL_FROM
APP_BASE_URL
ADMIN_BASE_URL
```

---

# 8. Foldering Setup

ساختار پیشنهادی:

```text
bextudio-platform/
├── app/
│   ├── (auth)/
│   ├── (app)/
│   ├── (admin)/
│   └── api/
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

هر feature:

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

# 9. Testing Setup

## 9.1 Tools

پیشنهاد:

- Vitest برای unit
- Testing Library برای components
- Playwright برای E2E

## 9.2 Critical Tests

### Access

- user without access cannot see intake.
- expired key fails.
- wrong email fails.
- CREATE_BRAND works.
- CLAIM_BRAND works.
- JOIN_BRAND works.

### Roles

- Owner can final submit.
- Specialist cannot final submit.
- Specialist cannot approve module.
- Internal Specialist cannot publish.
- Supervisor can send to client.
- Platform Owner can manual grant.

### Intake

- final submit disabled before 100%.
- locked intake cannot edit.
- snapshot created.
- change request does not mutate snapshot.

### Files

- files are private.
- signed URL works.
- specialist upload pending.
- client cannot see internal file.

### RAG

- client approval does not auto sync.
- only RAG_APPROVED files sync.
- no cross-brand retrieval.

### Agents

- locked before Brain ready.
- locked if plan excludes.
- owner can activate.
- specialist cannot activate.
- run logged.

---

# 10. Deployment Checklist

```text
[ ] Supabase envs set
[ ] OpenAI env set
[ ] Stripe env set
[ ] Email env set
[ ] Database migrations run
[ ] Seed data run
[ ] Storage buckets private
[ ] App builds
[ ] App starts on server
[ ] SSL works
[ ] Login works
[ ] Access key works
[ ] File upload works
[ ] Email sends
[ ] Webhook receives Stripe event
[ ] RAG sync works
[ ] Agent run works
[ ] Audit logs created
```

---

# 11. Security Checklist

```text
[ ] No service role key in client
[ ] No public buckets
[ ] Access keys hashed
[ ] Access keys expire
[ ] Email-bound access enforced
[ ] Brand permission checked server-side
[ ] Locked intake cannot edit
[ ] RAG sync checks approval
[ ] Agent checks entitlement
[ ] Audit logs exist
[ ] Admin routes protected
[ ] Signed URLs only
```

---

# 12. Final Rule

```text
Supabase gives speed.
Your product logic gives control.
OpenAI File Search gives MVP RAG.
Internal approvals protect Brand Brain.
Audit logs protect trust.
```
