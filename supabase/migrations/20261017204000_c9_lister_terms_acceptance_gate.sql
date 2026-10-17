-- C9: versioned lister-terms acceptance evidence and fail-closed selling gate.
-- The initial version is deliberately DRAFT. No seller can satisfy the public
-- selling gate until professional review is complete and a later migration
-- activates a reviewed version with an immutable content hash.

create table public.lister_terms_versions (
  version text primary key check (char_length(version) between 1 and 100),
  status text not null check (status in ('draft', 'active', 'retired')),
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  published_path text not null default '/lister-terms' check (char_length(published_path) between 1 and 500),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  retired_at timestamptz,
  check (status <> 'active' or (content_sha256 is not null and activated_at is not null))
);

alter table public.lister_terms_versions enable row level security;
revoke all on table public.lister_terms_versions from public, anon, authenticated;
grant select, insert, update on public.lister_terms_versions to service_role;

insert into public.lister_terms_versions (version, status, content_sha256, published_path)
values ('2026-10-17-prelaunch-v1', 'draft', null, '/lister-terms')
on conflict (version) do nothing;

create table public.lister_terms_acceptances (
  user_id uuid not null references public.profiles(id) on delete restrict,
  terms_version text not null references public.lister_terms_versions(version) on delete restrict,
  terms_sha256 text not null check (terms_sha256 ~ '^[0-9a-f]{64}$'),
  acceptance_source text not null default 'lister_portal' check (acceptance_source in ('lister_portal')),
  accepted_at timestamptz not null default now(),
  primary key (user_id, terms_version)
);

create index lister_terms_acceptances_user_idx
on public.lister_terms_acceptances (user_id, accepted_at desc);

alter table public.lister_terms_acceptances enable row level security;
create policy "lister_terms_acceptances_select_own_or_admin"
on public.lister_terms_acceptances
for select
to authenticated
using (user_id = (select auth.uid()) or (select private.has_role('admin')));
revoke all on table public.lister_terms_acceptances from public, anon, authenticated;
grant select on public.lister_terms_acceptances to authenticated;
grant select, insert on public.lister_terms_acceptances to service_role;

create or replace function public.get_current_lister_terms()
returns table (version text, content_sha256 text, published_path text, activated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select v.version, v.content_sha256, v.published_path, v.activated_at
  from public.lister_terms_versions v
  where v.status = 'active'
    and v.content_sha256 is not null
    and v.activated_at is not null
    and v.activated_at <= now()
  order by v.activated_at desc, v.version desc
  limit 1;
$$;

revoke all on function public.get_current_lister_terms() from public;
grant execute on function public.get_current_lister_terms() to authenticated;

create or replace function public.accept_current_lister_terms(p_source text default 'lister_portal')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_terms public.lister_terms_versions;
  accepting_user uuid := (select auth.uid());
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
  on conflict (user_id, terms_version) do update
    set terms_sha256 = excluded.terms_sha256,
        acceptance_source = excluded.acceptance_source;

  return current_terms.version;
end;
$$;

revoke all on function public.accept_current_lister_terms(text) from public;
grant execute on function public.accept_current_lister_terms(text) to authenticated;

create or replace function public.seller_terms_are_current(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lister_terms_versions v
    join public.lister_terms_acceptances a
      on a.terms_version = v.version
      and a.terms_sha256 = v.content_sha256
    where v.status = 'active'
      and v.content_sha256 is not null
      and v.activated_at is not null
      and v.activated_at <= now()
      and a.user_id = p_user_id
  );
$$;

revoke all on function public.seller_terms_are_current(uuid) from public;
grant execute on function public.seller_terms_are_current(uuid) to anon, authenticated;

-- Public/customer reads fail closed until seller identity, dispatch promise and
-- binding acceptance of the active Lister Terms are all present. Listers and
-- admins retain their existing own/admin visibility for setup and review.
drop policy if exists "products_select_published_anon" on public.products;
create policy "products_select_published_anon"
on public.products
for select
to anon
using (
  is_published = true
  and review_status = 'approved'
  and (select public.seller_identity_is_verified(lister_user_id))
  and (select public.seller_dispatch_is_ready(lister_user_id))
  and (select public.seller_terms_are_current(lister_user_id))
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
    and (select public.seller_dispatch_is_ready(lister_user_id))
    and (select public.seller_terms_are_current(lister_user_id))
  )
  or (lister_user_id = (select auth.uid()) and (select private.has_role('lister')))
  or (select private.has_role('admin'))
);