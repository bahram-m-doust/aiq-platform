-- Brand icons: PNG logos uploaded by platform owners

alter table public.brands
  add column if not exists icon_path text;

-- Public bucket so the icon can be rendered directly from <img src>
insert into storage.buckets (id, name, public)
values ('brand-icons', 'brand-icons', true)
on conflict (id) do update set public = true;

-- Public read for brand icons
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'brand_icons_public_read'
  ) then
    create policy brand_icons_public_read on storage.objects
      for select
      using (bucket_id = 'brand-icons');
  end if;
exception
  when insufficient_privilege then
    raise notice 'Skipping storage.objects policy creation; configure it through the Storage UI.';
end $$;
