-- HOLYHUB STAGE 3: storefronts and product listings.

create table public.lister_storefronts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  business_name text not null check (char_length(business_name) between 1 and 150),
  description text not null check (char_length(description) between 1 and 500),
  category_type text not null check (char_length(category_type) between 1 and 100),
  website_or_social text check (website_or_social is null or char_length(website_or_social) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  lister_user_id uuid not null references public.lister_storefronts(user_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 150),
  description text not null check (char_length(description) between 1 and 1000),
  category_type text not null check (char_length(category_type) between 1 and 100),
  price numeric(10, 2) not null check (price >= 0),
  currency text not null default 'GBP' check (currency = 'GBP'),
  image_url text check (image_url is null or char_length(image_url) between 1 and 500),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_published_category_idx
on public.products (category_type, created_at desc)
where is_published = true;

alter table public.lister_storefronts enable row level security;
alter table public.products enable row level security;

create policy "storefronts_select_public"
on public.lister_storefronts
for select
to anon, authenticated
using (true);

create policy "storefronts_insert_own_lister"
on public.lister_storefronts
for insert
to authenticated
with check (user_id = auth.uid() and public.has_role('lister'));

create policy "storefronts_update_own_lister"
on public.lister_storefronts
for update
to authenticated
using (user_id = auth.uid() and public.has_role('lister'))
with check (user_id = auth.uid() and public.has_role('lister'));

create policy "products_select_published_or_own"
on public.products
for select
to anon, authenticated
using (is_published = true or (user_id = auth.uid() and public.has_role('lister')));

create policy "products_insert_own_lister"
on public.products
for insert
to authenticated
with check (lister_user_id = auth.uid() and public.has_role('lister'));

create policy "products_update_own_lister"
on public.products
for update
to authenticated
using (lister_user_id = auth.uid() and public.has_role('lister'))
with check (lister_user_id = auth.uid() and public.has_role('lister'));

create policy "products_delete_own_lister"
on public.products
for delete
to authenticated
using (lister_user_id = auth.uid() and public.has_role('lister'));

-- Remove any inherited/default table privileges before granting the API roles only what they need.
revoke all on table public.lister_storefronts, public.products from public;
revoke all on table public.lister_storefronts, public.products from anon, authenticated;

grant select on public.lister_storefronts, public.products to anon, authenticated;
grant insert (user_id, business_name, description, category_type, website_or_social, updated_at)
on public.lister_storefronts to authenticated;
grant update (business_name, description, category_type, website_or_social, updated_at)
on public.lister_storefronts to authenticated;
grant insert (lister_user_id, name, description, category_type, price, currency, image_url, is_published)
on public.products to authenticated;
grant update (name, description, category_type, price, currency, image_url, is_published, updated_at)
on public.products to authenticated;
grant delete on public.products to authenticated;