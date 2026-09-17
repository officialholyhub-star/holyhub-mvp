-- HOLYHUB STAGE 1: accounts, roles and core row-level security.
-- Run this once in a new Supabase project's SQL editor.

create type public.app_role as enum ('customer', 'lister', 'admin');
create type public.account_status as enum ('active', 'suspended', 'closed');

create schema if not exists private authorization postgres;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (char_length(full_name) <= 100),
  account_status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

-- Security-definer helper avoids recursive RLS checks while testing roles.
create or replace function private.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid() and role = required_role
  );
$$;

revoke all on function private.has_role(public.app_role) from public;
grant execute on function private.has_role(public.app_role) to authenticated;

create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()) or (select private.has_role('admin')));

create policy "profiles_update_own_or_admin"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()) or (select private.has_role('admin')))
with check (id = (select auth.uid()) or (select private.has_role('admin')));

create policy "roles_select_own_or_admin"
on public.user_roles
for select
to authenticated
using (user_id = (select auth.uid()) or (select private.has_role('admin')));

-- New accounts always begin as customers. A later admin-controlled process can add lister access.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''));

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer');

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Browser roles receive only the narrow access required by the app.
revoke all on table public.profiles, public.user_roles from public;
revoke all on table public.profiles, public.user_roles from anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Customers can edit only the profile fields HolyHub intentionally exposes.
grant update (full_name, updated_at) on public.profiles to authenticated;
grant select on public.profiles, public.user_roles to authenticated;

-- IMPORTANT: initial admin role should be assigned manually by project owner in SQL after the owner account exists:
-- insert into public.user_roles (user_id, role) values ('YOUR_AUTH_USER_UUID', 'admin') on conflict do nothing;
