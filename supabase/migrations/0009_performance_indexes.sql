create index if not exists idx_brand_memberships_user_status_brand
on public.brand_memberships(user_id, status, brand_id);

create index if not exists idx_brand_entitlements_brand_status_window
on public.brand_entitlements(brand_id, status, starts_at, expires_at);

create index if not exists idx_intake_sessions_brand_status_created
on public.intake_sessions(brand_id, status, created_at desc);

create index if not exists idx_brand_modules_brand_status_updated
on public.brand_modules(brand_id, status, updated_at desc);

create index if not exists idx_brand_modules_assigned_updated
on public.brand_modules(assigned_to, updated_at desc);

create index if not exists idx_module_artifacts_module_version_created
on public.module_artifacts(module_id, version desc, created_at desc);

create index if not exists idx_module_reviews_module_created
on public.module_reviews(module_id, created_at desc);

create index if not exists idx_files_brand_status_created
on public.files(brand_id, status, created_at desc);

create index if not exists idx_change_requests_brand_status_created
on public.change_requests(brand_id, status, created_at desc);

create index if not exists idx_agent_runs_brand_agent_created
on public.agent_runs(brand_id, agent_id, created_at desc);

create index if not exists idx_audit_logs_brand_created
on public.audit_logs(brand_id, created_at desc);
