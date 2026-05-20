-- Tighten users_profile.global_role: ensure default is enforced, no nulls remain,
-- and only known role values are accepted.

update public.users_profile
   set global_role = 'REGISTERED_USER'
 where global_role is null;

alter table public.users_profile
  alter column global_role set default 'REGISTERED_USER',
  alter column global_role set not null;

alter table public.users_profile
  drop constraint if exists users_profile_global_role_check;

alter table public.users_profile
  add constraint users_profile_global_role_check
  check (
    global_role in (
      'REGISTERED_USER',
      'PLATFORM_OWNER',
      'SUPERVISOR',
      'INTERNAL_SPECIALIST'
    )
  );
