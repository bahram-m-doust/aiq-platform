# Bextudio MVP — Project Overview v0.1

## 1. تعریف پروژه

**Bextudio Platform** یک پلتفرم امن برای تبدیل داده‌های برند به **Brand Brain** و فعال‌سازی Agentهای اختصاصی است. MVP قرار نیست یک marketplace کامل، agent builder یا custom RAG سنگین باشد؛ هدف MVP این است که تجربه فعلی GPTها به یک پلتفرم مالکیت‌دار، قابل پرداخت، قابل کنترل، قابل audit و قابل ارائه به مشتری تبدیل شود.

### جریان اصلی محصول

```text
Register / Login
→ Inactive Dashboard
→ Brand Access Key یا Manual Admin Activation
→ Active Brand Workspace
→ Strategic Brand Intake
→ Final Submit + Lock
→ Internal Human Strategy Work
→ Supervisor Review
→ Client Review / Comment / Change Request
→ Internal RAG Approval
→ Brand Brain
→ Agent Activation
```

### اصل اصلی

```text
Only approved strategic knowledge powers agents.
```

هیچ فایل draft، فایل internal، فایل تاییدنشده، یا فایل آپلودی Specialist بدون تایید نباید وارد Brand Brain شود.

---

## 2. دامنه‌ها و محیط‌ها

| دامنه | نقش |
|---|---|
| `platform.helio.ae` | سایت مارکتینگ روی Framer؛ صفحات services/pricing/agent-store/projects/community |
| `app.helio.ae` | اپ مشتری؛ login، dashboard، intake، modules، agents، team |
| `admin.helio.ae` یا `/admin` | پنل داخلی؛ برندها، کاربران، پلن‌ها، access key، moduleها، RAG، audit |
| `api.helio.ae` | در آینده؛ فعلاً می‌تواند داخل Next.js API/Server Actions باشد |

### تصمیم deployment

- کدها روی سرور شرکت deploy می‌شوند.
- Supabase فعلاً برای Auth + Postgres + Storage استفاده می‌شود.
- Vercel فعلاً در تصمیم نهایی نیست.

---

## 3. نقش‌ها

## 3.1 Registered User

کاربری که account دارد ولی هنوز به برند فعال وصل نیست.

می‌تواند:
- login/register کند.
- Dashboard خاموش ببیند.
- Access Key وارد کند.
- درخواست demo/contact بدهد.

نمی‌تواند:
- سوال‌ها را ببیند.
- فایل‌ها را ببیند.
- Agent اجرا کند.

## 3.2 Brand Owner / Executive Manager

در MVP این دو نقش دسترسی یکسان دارند.

می‌تواند:
- برند را بسازد یا claim کند.
- همه سوال‌های Strategic Brand Intake را جواب دهد.
- قبل از Final Submit ویرایش کند.
- Final Submit کند.
- Specialist دعوت کند.
- فایل‌های Specialist را approve/reject کند.
- moduleها را review کند.
- comment بگذارد.
- approve یا request change بدهد.
- Agentهای available را فعال کند.

نمی‌تواند:
- بعد از lock مستقیم جواب‌ها را edit کند.
- فایل‌ها را برای RAG approve کند.
- prompt یا system rules را تغییر دهد.
- فایل‌های internal-only را ببیند.

## 3.3 Brand Specialist

کارشناس سمت مشتری.

می‌تواند:
- با email invitation وارد شود.
- فایل upload کند.
- فایل‌های مجاز را download کند.
- comment بگذارد.

نمی‌تواند:
- Final Submit کند.
- module approve کند.
- Agent فعال کند.
- billing/plan ببیند.
- کاربر جدید دعوت کند.

## 3.4 Internal Specialist

عضو تیم داخلی تولید فایل.

می‌تواند:
- روی moduleهای assign شده کار کند.
- فایل draft آپلود کند.
- comment داخلی بگذارد.

نمی‌تواند:
- مستقیم فایل را برای client review بفرستد.
- RAG approve کند.
- manual plan grant انجام دهد.

## 3.5 Supervisor

می‌تواند:
- فایل Internal Specialist را بررسی کند.
- module را برای Client Review approve کند.
- در RAG Approval مشارکت کند.
- تغییر status module را انجام دهد.

## 3.6 Platform Owner

مالک پلتفرم.

می‌تواند:
- همه برندها، users، accessها، modules، RAG، agents و audit logs را مدیریت کند.
- manual entitlement بدهد.
- access key بسازد و ایمیل کند.
- RAG final approval بدهد.

قانون: **حتی Platform Owner هم باید audit شود.**

---

## 4. Brand Access Key

Access Key نباید یک token همه‌کاره باشد. باید type داشته باشد.

| Type | کاربرد |
|---|---|
| `CREATE_BRAND` | کاربر با آن برند جدید می‌سازد. |
| `CLAIM_BRAND` | Admin برند را ساخته؛ کاربر آن را claim می‌کند. |
| `JOIN_BRAND` | دعوت user به برند موجود با role مشخص. |
| `DEMO_ACCESS` | دسترسی زمان‌دار برای demo. |
| `SUPPORT_ACCESS` | دسترسی موقت تیم داخلی با اجازه مشتری. |

### قوانین Access Key

- raw key هرگز ذخیره نمی‌شود.
- فقط hash ذخیره می‌شود.
- key باید expiry داشته باشد.
- key می‌تواند email-bound باشد.
- key باید role/scope داشته باشد.
- redeem شدن key باید audit شود.
- key استفاده‌شده یا expire شده نباید دوباره کار کند.

---

## 5. Plan و Entitlement

### پلن‌های فعلی MVP

| Plan | Price | Feature Logic |
|---|---:|---|
| Basic | $6,000 | شروع برند، Experience Book، Brand Integrator Brain، Agent محدود |
| Advanced | $30,000 | Brand City Canvas، Experience Book، Brain، Agentهای بیشتر |
| Enterprise | $55,000 | Founder Soul Print، Future Research، Canvas، Brain کامل، Agentهای کامل |

### تفاوت Plan و Entitlement

```text
Plan = تعریف محصول فروخته‌شده.
Entitlement = دسترسی واقعی یک برند به قابلیت‌ها.
```

Stripe و manual activation باید هر دو از یک تابع مشترک استفاده کنند:

```text
grantBrandAccess()
```

---

## 6. Dashboard

اسم صفحه اصلی بعد از login: **Dashboard**

Dashboard باید همیشه next action را روشن کند.

### حالت‌های اصلی

- `NO_ACCESS`
- `ACCESS_KEY_REQUIRED`
- `BRAND_CREATION_REQUIRED`
- `BRAND_CLAIM_REQUIRED`
- `INTAKE_NOT_STARTED`
- `INTAKE_IN_PROGRESS`
- `INTAKE_REVIEW`
- `INTAKE_LOCKED`
- `INTERNAL_PRODUCTION`
- `CLIENT_REVIEW`
- `CHANGE_REQUESTED`
- `RAG_REVIEW`
- `BRAIN_BUILDING`
- `BRAIN_READY`
- `AGENTS_AVAILABLE`
- `AGENTS_ACTIVE`

### نمونه متن Dashboard خاموش

```text
Your strategic workspace is ready, but not yet activated.
Activate access to begin the Brand Intelligence process and start building your Brand Brain.
```

---

## 7. Strategic Brand Intake

### شش section اصلی

1. Company
2. Consumer / Market Segmentation
3. User Persona
4. Products / Services
5. Context
6. Style / Tone of Voice

### قوانین

- همه سوال‌ها required هستند.
- skip نداریم.
- autosave داریم.
- final submit فقط بعد از completion = 100% فعال است.
- بعد از final submit، edit مستقیم ممنوع است.
- تغییر فقط با Change Request.

### بعد از Final Submit

- intake locked می‌شود.
- snapshot ساخته می‌شود.
- تیم داخلی notification می‌گیرد.
- client فقط read-only view دارد.
- Change Request فعال می‌شود.

---

## 8. Change Request

بعد از قفل شدن سوال‌ها، مشتری برای هر section یا question می‌تواند request ثبت کند.

Statusها:

- `REQUESTED`
- `UNDER_REVIEW`
- `APPROVED`
- `REJECTED`
- `APPLIED`
- `CLOSED`

قانون: Change Request نباید مستقیم snapshot را تغییر دهد. باید مسیر review داشته باشد.

---

## 9. Module System

فایل‌های نمونه OPAL نشان می‌دهند خروجی‌های Bextudio چه جنس و ساختاری دارند. از title و مفهوم آن‌ها برای moduleها استفاده می‌شود.

### Module Types

1. Brand Knowledge
2. Archetype
3. Market Intelligence
4. Research Benchmark
5. Brand City Canvas
6. City Experience Strategies
7. Language Style
8. Visual System
9. Touchpoint System
10. Brand Integrator Brain Pack

### Module Status

```text
NOT_STARTED
ASSIGNED
IN_PROGRESS
INTERNAL_REVIEW
SUPERVISOR_APPROVED
CLIENT_REVIEW
CLIENT_APPROVED
CLIENT_CHANGE_REQUESTED
RAG_REVIEW_REQUIRED
RAG_APPROVED
RAG_SYNCED
LOCKED
```

### File Artifacts

| Artifact | کاربرد |
|---|---|
| DOCX | فایل کاری تیم انسانی |
| PDF | preview رسمی برای مشتری |
| Markdown | ورودی تمیز برای Agent/RAG در آینده |
| JSON | داده ساختاریافته برای scale |

برای MVP، DOCX و PDF می‌توانند دستی upload شوند.

---

## 10. RAG Approval

Client Approval و RAG Approval یکی نیستند.

```text
Client Approval = مشتری خروجی را پذیرفته.
RAG Approval = تیم داخلی تایید کرده که فایل برای Brain مناسب است.
```

RAG Approval باید توسط Supervisor + Platform Owner انجام شود.

فقط فایل‌های `RAG_APPROVED` وارد Brand Brain می‌شوند.

---

## 11. Agentها

### Core Brain

- Brand Integrator Brain

### پنج Agent MVP

1. Story Teller
2. Image Generator
3. Video Generator
4. Campaign Maker
5. Brand Digital Activation

### قوانین Agent

- Agent باید در پلن باشد.
- Brand Brain باید آماده باشد.
- Owner باید agent را activate کند.
- Specialist اجازه activation ندارد.
- هر run باید log شود.

---

## 12. Admin Panel

### صفحات لازم

- Admin Dashboard
- Brands
- Users
- Access Keys
- Plans
- Entitlements
- Strategic Intake
- Locked Submissions
- Modules
- Files
- Client Comments
- Change Requests
- RAG Approval Queue
- Knowledge Bases
- Agents
- Agent Runs
- Audit Logs

### اکشن‌های مهم

- Create brand
- Create/send Access Key
- Grant manual access
- Suspend access
- Invite user
- Upload module DOCX/PDF
- Send module to client review
- Approve RAG
- Trigger RAG sync
- Activate/suspend agent
- View audit logs

---

## 13. Security Principles

- Login is not access.
- Access Key is not auth token.
- Brand access requires membership + entitlement.
- Every brand query must be scoped by brand_id.
- Raw access key must never be stored.
- Files must be private.
- Downloads must use signed URL.
- Locked intake cannot be edited.
- Client approval cannot trigger RAG sync.
- RAG sync only uses RAG_APPROVED files.
- Specialist cannot final submit.
- Specialist cannot module approve.
- Internal Specialist cannot publish to client.
- All sensitive actions must be audited.
- Demo access must expire.

---

## 14. Out of Scope for MVP

- Full marketplace
- AI Developer portal
- Agent Builder
- Custom RAG with pgvector
- Co-branding network
- Multi-brand agency dashboard
- Advanced analytics
- 3D dashboard
- Automated DOCX/PDF pipeline

---

## 15. MVP Success Criteria

MVP قابل قبول است اگر:

- user register/login کند.
- بدون access dashboard خاموش ببیند.
- Admin brand بسازد.
- Admin access key بسازد و ایمیل کند.
- user key را redeem کند.
- Brand active شود.
- Owner تمام سوال‌ها را جواب دهد.
- Final Submit قفل کند.
- تیم داخلی module upload کند.
- Supervisor برای client review بفرستد.
- Client approve یا request change بدهد.
- Supervisor + Platform Owner RAG approve کنند.
- فایل به OpenAI File Search sync شود.
- Brand Brain جواب بدهد.
- ۵ Agent بر اساس plan فعال شوند.
- همه اکشن‌های حساس audit شوند.
