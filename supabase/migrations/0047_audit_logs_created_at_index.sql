-- Index the global audit-log feed.
--
-- getLatestAuditLogs (features/audit/queries.ts) renders /admin/audit by
-- ordering audit_logs by created_at WITHOUT a brand filter. The only created_at
-- index is the composite idx_audit_logs_brand_created(brand_id, created_at desc)
-- from 0009 — a leading-brand_id index can't serve a brandless
-- ORDER BY created_at DESC, so Postgres falls back to a full scan + top-N sort
-- of the most write-heavy, globally-growing table on every page load. Add a
-- created_at-only index so the ordered range scan is index-backed.

create index if not exists idx_audit_logs_created_at
  on public.audit_logs (created_at desc);
