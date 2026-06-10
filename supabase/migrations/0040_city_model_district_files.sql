-- City Model district deliverables: one uploadable/approvable file per
-- (brand, district), mirroring the stakeholder/futures review-deliverable
-- pattern. Admin uploads a file for a district; the client views and approves.

create table if not exists public.city_model_district_files (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  district_key text not null,
  file_id uuid references public.files(id) on delete set null,
  status text not null default 'PENDING_UPLOAD',
  uploaded_by uuid references public.users_profile(id),
  uploaded_at timestamptz,
  approved_by uuid references public.users_profile(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, district_key)
);

create index if not exists city_model_district_files_brand_idx
  on public.city_model_district_files (brand_id);

-- Deny-by-default: all access is through the service-role admin client (no
-- policies), consistent with the other deliverable tables.
alter table public.city_model_district_files enable row level security;

-- Atomic: insert the file row + upsert the district deliverable in one txn,
-- returning the previous file id so its storage can be cleaned up.
create or replace function public.attach_city_model_district_file(
  p_brand_id uuid,
  p_district_key text,
  p_profile_id uuid,
  p_file_id uuid,
  p_storage_path text,
  p_original_name text,
  p_mime_type text,
  p_size_bytes bigint
)
returns table (deliverable_id uuid, old_file_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_old_file_id uuid;
  v_now timestamptz := now();
begin
  insert into public.city_model_district_files (brand_id, district_key, status)
  values (p_brand_id, p_district_key, 'PENDING_UPLOAD')
  on conflict (brand_id, district_key) do nothing;

  select id, file_id
    into v_id, v_old_file_id
    from public.city_model_district_files
   where brand_id = p_brand_id and district_key = p_district_key
   for update;

  insert into public.files (
    id, brand_id, storage_path, original_name,
    mime_type, size_bytes, visibility, status, uploaded_by
  )
  values (
    p_file_id, p_brand_id, p_storage_path, p_original_name,
    p_mime_type, p_size_bytes, 'CLIENT_REVIEW', 'CLIENT_REVIEW', p_profile_id
  );

  update public.city_model_district_files
     set file_id = p_file_id,
         status = 'CLIENT_REVIEW',
         uploaded_by = p_profile_id,
         uploaded_at = v_now,
         approved_by = null,
         approved_at = null,
         updated_at = v_now
   where id = v_id;

  return query select v_id, v_old_file_id;
end;
$$;
