alter table public.brand_api_keys
  alter column brand_id drop not null;

create unique index if not exists idx_brand_api_keys_global_provider_unique
  on public.brand_api_keys(provider)
  where brand_id is null;
