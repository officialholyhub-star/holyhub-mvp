-- Run after 001. One business profile per account; only reviewed listings are public.
begin;

create or replace function public.has_role(required_role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles r join public.profiles p on p.id = r.user_id
    where r.user_id = auth.uid() and r.role = required_role and p.account_status = 'active'
  );
$$;

create function public.is_active_account(account_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = account_id and account_status = 'active');
$$;
revoke all on function public.is_active_account(uuid) from public;
grant execute on function public.is_active_account(uuid) to anon, authenticated;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100),
  category text not null check (category in ('Fashion', 'Beauty', 'Food & Drink', 'Events', 'Music', 'Services', 'Art & Creators', 'Christian Brands')),
  location text not null check (char_length(trim(location)) between 2 and 100),
  summary text not null check (char_length(trim(summary)) between 10 and 180),
  description text not null check (char_length(trim(description)) between 30 and 3000),
  website_url text not null check (char_length(website_url) <= 500 and website_url ~ '^https?://[^[:space:]@/]+\.[^[:space:]@/]+'),
  faith_confirmed boolean not null check (faith_confirmed = true),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index businesses_discovery_idx on public.businesses (status, category, created_at desc);
alter table public.businesses enable row level security;

create policy "public_approved_businesses" on public.businesses for select to anon, authenticated
  using (status = 'approved' and public.is_active_account(owner_id));
create policy "owner_businesses" on public.businesses for select to authenticated
  using (owner_id = auth.uid() and public.is_active_account(auth.uid()));
create policy "admin_businesses" on public.businesses for select to authenticated
  using (public.has_role('admin'));
create policy "submit_own_business" on public.businesses for insert to authenticated
  with check (owner_id = auth.uid() and status = 'pending' and public.is_active_account(auth.uid()));
create policy "edit_own_business" on public.businesses for update to authenticated
  using (owner_id = auth.uid() and public.is_active_account(auth.uid()))
  with check (owner_id = auth.uid() and public.is_active_account(auth.uid()));

-- Column grants prevent clients from choosing IDs, owners on update, approval, or timestamps.
revoke all on public.businesses from anon, authenticated;
grant select on public.businesses to anon, authenticated;
grant insert (owner_id, name, category, location, summary, description, website_url, faith_confirmed) on public.businesses to authenticated;
grant update (name, category, location, summary, description, website_url, faith_confirmed) on public.businesses to authenticated;

create function public.business_before_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' or row(new.name, new.category, new.location, new.summary, new.description, new.website_url, new.faith_confirmed)
    is distinct from row(old.name, old.category, old.location, old.summary, old.description, old.website_url, old.faith_confirmed) then
    new.status := 'pending';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create trigger business_update before update on public.businesses
  for each row execute function public.business_before_update();

-- Approval is possible only through this gated function, never by updating a browser payload.
-- Version check prevents approving content that changed since the reviewer opened it.
create function public.review_business(listing_id uuid, decision text, expected_updated_at timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
declare reviewed_owner uuid;
begin
  if not public.has_role('admin') then raise exception 'Not authorised' using errcode = '42501'; end if;
  if decision not in ('approved', 'rejected') or decision is null then raise exception 'Invalid decision'; end if;
  update public.businesses set status = decision
    where id = listing_id and updated_at = expected_updated_at and public.is_active_account(owner_id)
    returning owner_id into reviewed_owner;
  if not found then return false; end if;
  if decision = 'approved' then
    insert into public.user_roles (user_id, role) values (reviewed_owner, 'lister') on conflict do nothing;
  end if;
  return true;
end;
$$;
revoke all on function public.review_business(uuid, text, timestamptz) from public;
grant execute on function public.review_business(uuid, text, timestamptz) to authenticated;

-- Also bound metadata arriving through the public authentication API, not just our form.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
    values (new.id, nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 100), ''));
  insert into public.user_roles (user_id, role) values (new.id, 'customer');
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public;
revoke all on function public.business_before_update() from public;
commit;
