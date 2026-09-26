-- Store only church locations intentionally selected or entered by an account owner.
create table public.church_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references public.profiles(id) on delete cascade,
  church_name text not null check (char_length(church_name) between 1 and 200),
  formatted_address text not null check (char_length(formatted_address) between 1 and 500),
  postcode text not null default '' check (char_length(postcode) <= 30),
  city text not null default '' check (char_length(city) <= 120),
  country text not null default 'United Kingdom' check (char_length(country) between 1 and 100),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  google_place_id text,
  place_types text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint church_profiles_coordinates_pair check ((latitude is null) = (longitude is null))
);

create unique index church_profiles_google_place_id_key
on public.church_profiles (google_place_id)
where google_place_id is not null;

alter table public.church_profiles enable row level security;

create policy "church_profiles_select_own"
on public.church_profiles
for select
to authenticated
using (owner_user_id = (select auth.uid()));

create policy "church_profiles_insert_own"
on public.church_profiles
for insert
to authenticated
with check (owner_user_id = (select auth.uid()));

create policy "church_profiles_update_own"
on public.church_profiles
for update
to authenticated
using (owner_user_id = (select auth.uid()))
with check (owner_user_id = (select auth.uid()));

revoke all on table public.church_profiles from public, anon, authenticated;
grant select, insert, update on public.church_profiles to authenticated;