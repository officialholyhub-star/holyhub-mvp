-- C5: seller/trader legal identity, verification and checkout snapshots.
-- Forward-only migration. Existing historical checkout rows remain nullable.

create table public.seller_legal_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  legal_name text not null check (char_length(legal_name) between 1 and 200),
  entity_type text not null check (entity_type in ('sole_trader', 'limited_company', 'partnership', 'charity_nonprofit', 'other')),
  address_line1 text not null check (char_length(address_line1) between 1 and 200),
  address_line2 text check (address_line2 is null or char_length(address_line2) between 1 and 200),
  city text not null check (char_length(city) between 1 and 120),
  postcode text not null check (char_length(postcode) between 1 and 30),
  country text not null check (char_length(country) between 1 and 100),
  contact_email text not null check (char_length(contact_email) between 3 and 254),
  contact_phone text check (contact_phone is null or char_length(contact_phone) between 1 and 50),
  registration_number text check (registration_number is null or char_length(registration_number) between 1 and 100),
  vat_number text check (vat_number is null or char_length(vat_number) between 1 and 100),
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
  verification_note text check (verification_note is null or char_length(verification_note) between 1 and 1000),
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (entity_type <> 'limited_company' or registration_number is not null)
);

create index seller_legal_profiles_verification_idx
on public.seller_legal_profiles (verification_status, user_id);

alter table public.seller_legal_profiles enable row level security;

create policy "seller_legal_profiles_select_own_or_admin"
on public.seller_legal_profiles
for select
to authenticated
using (user_id = (select auth.uid()) or (select private.has_role('admin')));

revoke all on table public.seller_legal_profiles from public, anon, authenticated;
grant select on public.seller_legal_profiles to authenticated;
grant select, insert, update on public.seller_legal_profiles to service_role;

-- Public RLS needs a boolean check without granting anon direct SELECT access to
-- the private seller profile table. Keep the helper deliberately narrow.
create or replace function public.seller_identity_is_verified(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.seller_legal_profiles s
    where s.user_id = p_user_id
      and s.verification_status = 'verified'
  );
$$;

revoke all on function public.seller_identity_is_verified(uuid) from public;
grant execute on function public.seller_identity_is_verified(uuid) to anon, authenticated;

-- Public customers may only retrieve the disclosure fields of a verified seller
-- who currently has at least one approved, published product. The underlying
-- private profile table remains unavailable to anon users.
create or replace function public.get_public_seller_identities(p_user_ids uuid[])
returns table (
  user_id uuid,
  legal_name text,
  entity_type text,
  address_line1 text,
  address_line2 text,
  city text,
  postcode text,
  country text,
  contact_email text,
  contact_phone text,
  registration_number text,
  vat_number text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.user_id,
    s.legal_name,
    s.entity_type,
    s.address_line1,
    s.address_line2,
    s.city,
    s.postcode,
    s.country,
    s.contact_email,
    s.contact_phone,
    s.registration_number,
    s.vat_number
  from public.seller_legal_profiles s
  where s.verification_status = 'verified'
    and s.user_id = any(p_user_ids)
    and exists (
      select 1
      from public.products p
      where p.lister_user_id = s.user_id
        and p.is_published = true
        and p.review_status = 'approved'
    );
$$;

revoke all on function public.get_public_seller_identities(uuid[]) from public;
grant execute on function public.get_public_seller_identities(uuid[]) to anon, authenticated;

-- A product can remain saved/reviewable before identity verification, but it is
-- not customer-visible until the seller's legal profile is verified.
drop policy if exists "products_select_published_anon" on public.products;
create policy "products_select_published_anon"
on public.products
for select
to anon
using (
  is_published = true
  and review_status = 'approved'
  and (select public.seller_identity_is_verified(lister_user_id))
);

drop policy if exists "products_select_authenticated" on public.products;
create policy "products_select_authenticated"
on public.products
for select
to authenticated
using (
  (
    is_published = true
    and review_status = 'approved'
    and (select public.seller_identity_is_verified(lister_user_id))
  )
  or (lister_user_id = (select auth.uid()) and (select private.has_role('lister')))
  or (select private.has_role('admin'))
);

-- Snapshot the verified seller identity at checkout so later confirmation and
-- dispute evidence does not depend on mutable live profile data.
alter table public.checkout_session_sellers
  add column seller_legal_name text check (seller_legal_name is null or char_length(seller_legal_name) between 1 and 200),
  add column seller_entity_type text check (seller_entity_type is null or seller_entity_type in ('sole_trader', 'limited_company', 'partnership', 'charity_nonprofit', 'other')),
  add column seller_address_line1 text check (seller_address_line1 is null or char_length(seller_address_line1) between 1 and 200),
  add column seller_address_line2 text check (seller_address_line2 is null or char_length(seller_address_line2) between 1 and 200),
  add column seller_city text check (seller_city is null or char_length(seller_city) between 1 and 120),
  add column seller_postcode text check (seller_postcode is null or char_length(seller_postcode) between 1 and 30),
  add column seller_country text check (seller_country is null or char_length(seller_country) between 1 and 100),
  add column seller_contact_email text check (seller_contact_email is null or char_length(seller_contact_email) between 3 and 254),
  add column seller_contact_phone text check (seller_contact_phone is null or char_length(seller_contact_phone) between 1 and 50),
  add column seller_registration_number text check (seller_registration_number is null or char_length(seller_registration_number) between 1 and 100),
  add column seller_vat_number text check (seller_vat_number is null or char_length(seller_vat_number) between 1 and 100),
  add column seller_identity_verified_at timestamptz,
  add column seller_identity_profile_updated_at timestamptz;
