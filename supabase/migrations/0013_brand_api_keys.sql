create table if not exists public.brand_api_keys (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  provider text not null default 'OPENROUTER',
  encrypted_key text not null,
  label text,
  is_active boolean not null default true,
  created_by uuid references public.users_profile(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (brand_id, provider)
);

create index if not exists idx_brand_api_keys_brand on public.brand_api_keys(brand_id);
alter table public.brand_api_keys enable row level security;
alter table public.brand_api_keys force row level security;
