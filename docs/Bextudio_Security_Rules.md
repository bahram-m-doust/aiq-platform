# Bextudio MVP — Security Rules v0.1

## 1. اصل امنیتی محصول

Bextudio با داده‌های محرمانه‌ی برند، فایل‌های استراتژیک، خروجی‌های انسانی، Agentها و RAG سروکار دارد. بنابراین اصل امنیتی محصول این است:

```text
Login is identity, not access.
Access = Membership + Entitlement + Permission + Resource Scope.
```

## 2. قوانین غیرقابل مذاکره

```text
1. Login alone must not activate any brand workspace.
2. Every brand query must be scoped by brand_id.
3. Every user action must be checked server-side.
4. Client-side hiding is only UX, not security.
5. Access Keys must never be stored raw.
6. Files must never be public by default.
7. Locked intake answers must never be edited directly.
8. Change after lock must go through Change Request.
9. Client Approval must not trigger RAG sync.
10. RAG sync must only use RAG_APPROVED files.
11. Specialist cannot final submit or approve modules.
12. Internal Specialist cannot publish directly to client.
13. All sensitive admin actions must create audit logs.
14. Production secrets must never be pasted into AI tools.
15. Service Role key must never be exposed to browser.
```

## 3. Auth Rules

```text
- Use Supabase Auth for identity.
- Store extra profile data in users_profile.
- Do not use email alone for permission.
- User permissions come from brand_memberships and internal role tables.
- Middleware must protect dashboard/admin routes.
```

## 4. Access Key Rules

```text
Access Key is not JWT.
Access Key is not session token.
Access Key is not API key.
Access Key is a redeemable activation/invitation credential.
```

### Required Fields

```text
key_hash
key_prefix
type
status
target_email
target_brand_id
target_role
plan_id
expires_at
redeemed_by
redeemed_at
created_by
```

### Validation

```text
1. Key exists by hash.
2. status = ACTIVE.
3. expires_at > now.
4. target_email matches current user email if set.
5. redemption limit not exceeded.
6. type matches attempted action.
7. audit log is created on success and failed high-risk attempts.
```

## 5. Brand Isolation Rules

Every resource must belong to brand when applicable:

```text
brands
brand_memberships
intake_sessions
intake_answers
intake_snapshots
brand_modules
module_artifacts
files
knowledge_bases
knowledge_files
agent_runs
audit_logs
```

Every query must include `brand_id` unless it is global admin-only metadata.

## 6. File Security Rules

```text
- Use private storage bucket.
- Never expose permanent public links.
- Generate signed URL only after permission check.
- Audit file download.
- Specialist-uploaded files default to PENDING_OWNER_APPROVAL.
- Internal files default to HELIO_INTERNAL.
- Client preview files use CLIENT_REVIEW visibility.
- Agent-visible files must be RAG_APPROVED or explicitly approved.
```

## 7. Intake Lock Rules

```text
Before Final Submit:
Owner/Executive Manager can edit answers.

After Final Submit:
Answers are locked.
Direct edit disabled.
System creates intake_snapshot.
Only Change Request can propose corrections.
```

## 8. RAG Safety Rules

```text
- Draft files never enter RAG.
- Internal review files never enter RAG.
- Specialist uploads never enter RAG unless approved by Owner and internal team.
- Client approval alone is not enough.
- Supervisor + Platform Owner must approve RAG readiness.
- Each brand has isolated vector store in MVP.
- Agent runs must use current brand vector store only.
```

## 9. Admin Security Rules

```text
- Admin panel requires Platform Owner or authorized internal role.
- Manual plan grant requires Platform Owner.
- RAG approval requires Supervisor and/or Platform Owner according to policy.
- Admin override must be explicitly logged.
- Admin cannot silently impersonate client approval.
- Support access must be time-limited and audited.
```

## 10. Required Audit Events

```text
access_key_created
access_key_redeemed
access_key_failed
brand_created
brand_claimed
plan_granted
plan_suspended
member_invited
member_joined
intake_answer_updated
intake_final_submitted
change_request_created
file_uploaded
file_downloaded
specialist_file_approved
module_uploaded
module_sent_to_client
module_client_approved
module_change_requested
rag_approved
rag_sync_started
rag_sync_completed
agent_activated
agent_run_created
admin_override_used
```

## 11. Environment Security

```text
- Keep .env out of git.
- Use .env.example with placeholder values.
- Use separate Supabase projects for staging and production if possible.
- Rotate OpenAI/Stripe/SMTP keys if leaked.
- Never paste service role key into prompts.
- Never paste customer files into public AI tools outside approved system.
```
