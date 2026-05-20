insert into storage.buckets (id, name, public)
values ('bextudio-files', 'bextudio-files', false)
on conflict (id) do update
set public = false;
