-- HOLYHUB STAGE 6: customer favourites.

create table public.favourites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index favourites_user_created_idx
on public.favourites (user_id, created_at desc);

alter table public.favourites enable row level security;

create policy "favourites_select_own"
on public.favourites
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "favourites_insert_own"
on public.favourites
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "favourites_delete_own"
on public.favourites
for delete
to authenticated
using (user_id = (select auth.uid()));

revoke all on table public.favourites from public, anon, authenticated;
grant select, insert, delete on public.favourites to authenticated;
