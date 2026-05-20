alter table public.change_requests
  add column if not exists reason text;
