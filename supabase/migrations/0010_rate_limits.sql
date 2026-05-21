create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  identifier_hash text not null,
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket, identifier_hash, window_start)
);

create index if not exists idx_rate_limits_bucket_identifier_window
on public.rate_limits(bucket, identifier_hash, window_start desc);

create index if not exists idx_rate_limits_window_start
on public.rate_limits(window_start);

alter table public.rate_limits enable row level security;
alter table public.rate_limits force row level security;

revoke all on table public.rate_limits from anon, authenticated;

create or replace function public.increment_rate_limit(
  p_bucket text,
  p_identifier_hash text,
  p_window_start timestamptz
)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.rate_limits (bucket, identifier_hash, window_start, count)
  values (p_bucket, p_identifier_hash, p_window_start, 1)
  on conflict (bucket, identifier_hash, window_start)
  do update
     set count = public.rate_limits.count + 1,
         updated_at = now()
  returning count;
$$;

revoke all on function public.increment_rate_limit(text, text, timestamptz)
from public, anon, authenticated;

grant execute on function public.increment_rate_limit(text, text, timestamptz)
to service_role;
