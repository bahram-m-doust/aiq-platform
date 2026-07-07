# AIQ STUDIO MVP — Database Schema v0.1

## 1. هدف

این سند schema پیشنهادی Supabase/Postgres را برای MVP تعریف می‌کند. این schema برای ساخت سریع MVP است، اما طوری طراحی شده که بعداً قابل scale و refactor باشد.

## 2. Conventions

```text
- Table names: plural snake_case
- IDs: uuid
- Status values: text with UPPER_SNAKE_CASE values
- created_at on all important tables
- updated_at on mutable tables
- brand_id on all brand-scoped resources
- No raw Access Key storage
```

## 3. Core Tables

### users_profile

```sql
create table users_profile (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  email text not null,
  full_name text,
  global_role text default 'REGISTERED_USER',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### brands

```sql
create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  website text,
  status text not null default 'CREATED',
  created_by uuid references users_profile(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_brands_status on brands(status);
```

### brand_memberships

```sql
create table brand_memberships (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  user_id uuid not null references users_profile(id) on delete cascade,
  role text not null,
  status text not null default 'ACTIVE',
  invited_by uuid references users_profile(id),
  expires_at timestamptz,
  created_at timestamptz default now(),
  unique (brand_id, user_id, role)
);

create index idx_brand_memberships_brand on brand_memberships(brand_id);
create index idx_brand_memberships_user on brand_memberships(user_id);
```

## 4. Access & Plans

### access_keys

```sql
create table access_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  key_prefix text not null,
  type text not null,
  status text not null default 'ACTIVE',
  target_email text,
  target_brand_id uuid references brands(id),
  target_role text,
  plan_id uuid,
  max_redemptions int default 1,
  redeemed_count int default 0,
  expires_at timestamptz not null,
  redeemed_by uuid references users_profile(id),
  redeemed_at timestamptz,
  created_by uuid references users_profile(id),
  created_at timestamptz default now()
);

create index idx_access_keys_status on access_keys(status);
create index idx_access_keys_target_email on access_keys(target_email);
```

### plans

```sql
create table plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric,
  currency text default 'USD',
  duration_days int,
  included_modules jsonb default '[]'::jsonb,
  included_agents jsonb default '[]'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

### brand_entitlements

```sql
create table brand_entitlements (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  plan_id uuid not null references plans(id),
  source text not null,
  status text not null default 'ACTIVE',
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  granted_by uuid references users_profile(id),
  manual_reference text,
  internal_note text,
  created_at timestamptz default now()
);

create index idx_brand_entitlements_brand on brand_entitlements(brand_id);
create index idx_brand_entitlements_status on brand_entitlements(status);
```

## 5. Intake Tables

### question_sections

```sql
create table question_sections (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text not null,
  description text,
  order_index int not null,
  is_required boolean default true,
  created_at timestamptz default now()
);
```

### questions

```sql
create table questions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references question_sections(id) on delete cascade,
  key text not null unique,
  question_text text not null,
  help_text text,
  input_type text not null,
  is_required boolean default true,
  order_index int not null,
  validation_schema jsonb,
  created_at timestamptz default now()
);

create index idx_questions_section on questions(section_id);
```

### intake_sessions

```sql
create table intake_sessions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  status text not null default 'DRAFT',
  completion_percent int default 0,
  locked_at timestamptz,
  locked_by uuid references users_profile(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_intake_sessions_brand on intake_sessions(brand_id);
create index idx_intake_sessions_status on intake_sessions(status);
```

### intake_answers

```sql
create table intake_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references intake_sessions(id) on delete cascade,
  question_id uuid not null references questions(id),
  value jsonb,
  updated_by uuid references users_profile(id),
  updated_at timestamptz default now(),
  unique (session_id, question_id)
);
```

### intake_snapshots

```sql
create table intake_snapshots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references intake_sessions(id),
  brand_id uuid not null references brands(id),
  snapshot_json jsonb not null,
  generated_docx_file_id uuid,
  created_at timestamptz default now()
);
```

## 6. Module Tables

### brand_modules

```sql
create table brand_modules (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  module_type text not null,
  title text not null,
  status text not null default 'NOT_STARTED',
  assigned_to uuid references users_profile(id),
  supervisor_id uuid references users_profile(id),
  current_version int default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_brand_modules_brand on brand_modules(brand_id);
create index idx_brand_modules_status on brand_modules(status);
```

### module_artifacts

```sql
create table module_artifacts (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references brand_modules(id) on delete cascade,
  artifact_type text not null,
  file_id uuid,
  version int default 1,
  status text default 'UPLOADED',
  uploaded_by uuid references users_profile(id),
  created_at timestamptz default now()
);
```

### module_reviews

```sql
create table module_reviews (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references brand_modules(id) on delete cascade,
  reviewer_id uuid not null references users_profile(id),
  review_type text not null,
  decision text not null,
  comment text,
  created_at timestamptz default now()
);
```

### change_requests

```sql
create table change_requests (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  target_type text not null,
  target_id uuid,
  section_key text,
  question_id uuid references questions(id),
  requested_by uuid references users_profile(id),
  comment text not null,
  status text not null default 'REQUESTED',
  reviewed_by uuid references users_profile(id),
  resolution_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## 7. Files

```sql
create table files (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  mime_type text,
  size_bytes bigint,
  visibility text not null default 'HELIO_INTERNAL',
  status text not null default 'UPLOADED',
  uploaded_by uuid references users_profile(id),
  created_at timestamptz default now()
);

create index idx_files_brand on files(brand_id);
create index idx_files_status on files(status);
```

## 8. RAG & Agents

### knowledge_bases

```sql
create table knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  provider text not null default 'OPENAI_FILE_SEARCH',
  provider_vector_store_id text,
  status text default 'NOT_READY',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (brand_id, provider)
);
```

### knowledge_files

```sql
create table knowledge_files (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  module_id uuid references brand_modules(id),
  file_id uuid references files(id),
  provider_file_id text,
  rag_status text not null default 'NOT_ELIGIBLE',
  approved_by_supervisor uuid references users_profile(id),
  approved_by_platform_owner uuid references users_profile(id),
  synced_at timestamptz,
  created_at timestamptz default now()
);
```

### agents

```sql
create table agents (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  required_modules jsonb default '[]'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

### agent_entitlements

```sql
create table agent_entitlements (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  agent_id uuid not null references agents(id),
  plan_id uuid references plans(id),
  status text not null default 'LOCKED_BY_PLAN',
  starts_at timestamptz,
  expires_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz default now(),
  unique (brand_id, agent_id)
);
```

### agent_runs

```sql
create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  agent_id uuid references agents(id),
  user_id uuid references users_profile(id),
  input jsonb,
  output jsonb,
  provider text,
  model text,
  retrieved_sources jsonb,
  cost numeric,
  latency_ms int,
  created_at timestamptz default now()
);
```

## 9. Audit Logs

```sql
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users_profile(id),
  actor_role text,
  brand_id uuid references brands(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  before_json jsonb,
  after_json jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

create index idx_audit_logs_brand on audit_logs(brand_id);
create index idx_audit_logs_actor on audit_logs(actor_user_id);
create index idx_audit_logs_action on audit_logs(action);
```

## 10. Seed Data Required

### Plans

```text
BASIC
ADVANCED
ENTERPRISE
```

### Agents

```text
BRAND_INTEGRATOR_BRAIN
STORY_TELLER
IMAGE_GENERATOR
VIDEO_GENERATOR
CAMPAIGN_MAKER
BRAND_DIGITAL_ACTIVATION
```

### Question Sections

```text
COMPANY
CONSUMER_MARKET_SEGMENTATION
USER_PERSONA
PRODUCTS_SERVICES
CONTEXT
STYLE_TONE_OF_VOICE
```

### Module Types

```text
BRAND_KNOWLEDGE
ARCHETYPE
MARKET_INTELLIGENCE
RESEARCH_BENCHMARK
BRAND_CITY_CANVAS
CITY_EXPERIENCE_STRATEGIES
LANGUAGE_STYLE
VISUAL_SYSTEM
TOUCHPOINT_SYSTEM
BRAND_INTEGRATOR_BRAIN_PACK
```
