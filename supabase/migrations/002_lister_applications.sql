-- HOLYHUB STAGE 2: lister applications.

create type public.lister_application_status as enum ('pending', 'approved', 'rejected');

create table public.lister_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  business_name text not null check (char_length(business_name) between 1 and 150),
  contact_name text not null check (char_length(contact_name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 254),
  website_or_social text not null check (char_length(website_or_social) between 1 and 500),
  description text not null check (char_length(description) between 1 and 500),
  category_type text not null check (char_length(category_type) between 1 and 100),
  status public.lister_application_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index lister_applications_one_active_per_user
on public.lister_applications (user_id)
where status in ('pending', 'approved');

alter table public.lister_applications enable row level security;

create policy "lister_applications_select_own_or_admin"
on public.lister_applications
for select
to authenticated
using (user_id = (select auth.uid()) or (select private.has_role('admin')));

create policy "lister_applications_insert_own"
on public.lister_applications
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "lister_applications_update_admin"
on public.lister_applications
for update
to authenticated
using ((select private.has_role('admin')))
with check ((select private.has_role('admin')));

revoke all on table public.lister_applications from public;
revoke all on table public.lister_applications from anon, authenticated;

grant select, insert on public.lister_applications to authenticated;
grant update (status, updated_at) on public.lister_applications to authenticated;
