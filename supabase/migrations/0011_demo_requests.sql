-- Demo Request flow: lets a signed-in user without brand access ask the
-- platform owner for a DEMO_ACCESS key. Admin acts on requests from
-- /admin/demo-requests.

create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users_profile(id) on delete set null,
  email text not null,
  message text,
  status text not null default 'REQUESTED',
  reviewed_by uuid references public.users_profile(id),
  reviewed_at timestamptz,
  resolution_note text,
  approved_access_key_id uuid references public.access_keys(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_demo_requests_status_created_at
on public.demo_requests(status, created_at desc);

create index if not exists idx_demo_requests_user_id
on public.demo_requests(user_id);

alter table public.demo_requests enable row level security;
alter table public.demo_requests force row level security;

revoke all on table public.demo_requests from anon, authenticated;
