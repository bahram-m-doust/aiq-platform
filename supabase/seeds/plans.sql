insert into public.plans (name)
values
  ('BASIC'),
  ('ADVANCED'),
  ('ENTERPRISE')
on conflict (name) do nothing;
