-- Audit remediation: keep public seller identity and Lister Terms gates aligned.
-- Forward-only. No Terms are activated by this migration.

-- There must be one unambiguous current active Terms version at most.
create unique index if not exists lister_terms_one_active_idx
on public.lister_terms_versions ((status))
where status = 'active';

-- Once a version has been activated, its contract identity/content pointer is
-- immutable. Retiring it is allowed; silently changing the accepted contract is not.
create or replace function private.guard_lister_terms_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('active', 'retired') and (
    new.version is distinct from old.version
    or new.content_sha256 is distinct from old.content_sha256
    or new.published_path is distinct from old.published_path
    or new.activated_at is distinct from old.activated_at
  ) then
    raise exception 'Activated Lister Terms versions are immutable.';
  end if;

  if old.status = 'active' and new.status not in ('active', 'retired') then
    raise exception 'Active Lister Terms may only remain active or be retired.';
  end if;

  if old.status = 'retired' and new.status <> 'retired' then
    raise exception 'Retired Lister Terms cannot be reactivated.';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_lister_terms_version_mutation() from public;

drop trigger if exists lister_terms_versions_guard_mutation on public.lister_terms_versions;
create trigger lister_terms_versions_guard_mutation
before update on public.lister_terms_versions
for each row execute function private.guard_lister_terms_version_mutation();

-- Accept exactly the single current active version. Repeated submissions are
-- idempotent and never rewrite the original acceptance timestamp/hash.
create or replace function public.accept_current_lister_terms(p_source text default 'lister_portal')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_terms public.lister_terms_versions;
  accepting_user uuid := (select auth.uid());
  saved_hash text;
begin
  if accepting_user is null or not (select private.has_role('lister')) then
    raise exception 'Lister access is required.' using errcode = '42501';
  end if;
  if p_source <> 'lister_portal' then
    raise exception 'Invalid acceptance source.';
  end if;

  select * into current_terms
  from public.lister_terms_versions v
  where v.status = 'active'
    and v.content_sha256 is not null
    and v.activated_at is not null
    and v.activated_at <= now()
  order by v.activated_at desc, v.version desc
  limit 1;

  if not found then
    raise exception 'Final Lister Terms are not active yet.';
  end if;

  insert into public.lister_terms_acceptances (
    user_id, terms_version, terms_sha256, acceptance_source
  ) values (
    accepting_user, current_terms.version, current_terms.content_sha256, p_source
  )
  on conflict (user_id, terms_version) do nothing;

  select a.terms_sha256 into saved_hash
  from public.lister_terms_acceptances a
  where a.user_id = accepting_user and a.terms_version = current_terms.version;

  if saved_hash is distinct from current_terms.content_sha256 then
    raise exception 'Saved Lister Terms acceptance does not match the current version.';
  end if;

  return current_terms.version;
end;
$$;

revoke all on function public.accept_current_lister_terms(text) from public;
grant execute on function public.accept_current_lister_terms(text) to authenticated;

-- Selling readiness requires acceptance of the same single current version that
-- the UI exposes, rather than acceptance of any row that happens to be active.
create or replace function public.seller_terms_are_current(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with current_terms as (
    select v.version, v.content_sha256
    from public.lister_terms_versions v
    where v.status = 'active'
      and v.content_sha256 is not null
      and v.activated_at is not null
      and v.activated_at <= now()
    order by v.activated_at desc, v.version desc
    limit 1
  )
  select exists (
    select 1
    from current_terms v
    join public.lister_terms_acceptances a
      on a.terms_version = v.version
      and a.terms_sha256 = v.content_sha256
    where a.user_id = p_user_id
  );
$$;

revoke all on function public.seller_terms_are_current(uuid) from public;
grant execute on function public.seller_terms_are_current(uuid) to anon, authenticated;

-- Public seller/trader details must never have a weaker readiness gate than the
-- public product itself. Identity, dispatch promise and current Terms acceptance
-- are all required before these details are returned.
create or replace function public.get_public_seller_identities(p_user_ids uuid[])
returns table (
  user_id uuid, legal_name text, entity_type text,
  address_line1 text, address_line2 text, city text, postcode text, country text,
  service_address_line1 text, service_address_line2 text, service_address_city text, service_address_postcode text, service_address_country text,
  contact_email text, contact_phone text,
  registration_number text, registration_jurisdiction text,
  registered_office_line1 text, registered_office_line2 text, registered_office_city text, registered_office_postcode text, registered_office_country text,
  vat_number text
)
language sql stable security definer set search_path = '' as $$
  select s.user_id, s.legal_name, s.entity_type,
    s.address_line1, s.address_line2, s.city, s.postcode, s.country,
    s.service_address_line1, s.service_address_line2, s.service_address_city, s.service_address_postcode, s.service_address_country,
    s.contact_email, s.contact_phone, s.registration_number, s.registration_jurisdiction,
    s.registered_office_line1, s.registered_office_line2, s.registered_office_city, s.registered_office_postcode, s.registered_office_country,
    s.vat_number
  from public.seller_legal_profiles s
  where s.verification_status = 'verified'
    and s.user_id = any(p_user_ids)
    and (select public.seller_dispatch_is_ready(s.user_id))
    and (select public.seller_terms_are_current(s.user_id))
    and exists (
      select 1 from public.products p
      where p.lister_user_id = s.user_id
        and p.is_published = true
        and p.review_status = 'approved'
    );
$$;

revoke all on function public.get_public_seller_identities(uuid[]) from public;
grant execute on function public.get_public_seller_identities(uuid[]) to anon, authenticated;
