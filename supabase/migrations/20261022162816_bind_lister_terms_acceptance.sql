-- Phase 2: accept only the exact displayed version/hash. No Terms activation.
-- Retire the unbound endpoint; callers must supply the displayed contract.
begin;

drop function public.accept_current_lister_terms(text);

create or replace function public.accept_current_lister_terms(p_version text, p_sha256 text, p_source text default 'lister_portal')
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
  if p_source is distinct from 'lister_portal' then
    raise exception 'Invalid acceptance source.';
  end if;

  -- SHARE conflicts with every INSERT/UPDATE/DELETE on this table, including
  -- rotation that retires one version and inserts/activates another. Hold until
  -- transaction end; subsequent statements see rotations committed before lock.
  lock table public.lister_terms_versions in share mode;

  select * into current_terms
  from public.lister_terms_versions v
  where v.status = 'active'
    and v.content_sha256 is not null
    and v.activated_at is not null
    and v.activated_at <= now()
  order by v.activated_at desc, v.version desc
  limit 1;

  if not found or p_version is distinct from current_terms.version
    or p_sha256 is distinct from current_terms.content_sha256 then
    raise exception 'Displayed Lister Terms are no longer current.' using errcode = 'P0002';
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

revoke all on function public.accept_current_lister_terms(text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.accept_current_lister_terms(text,text,text) to authenticated;

-- Fail the migration if an unexpected callable overload would survive.
do $$
begin
  if (select count(*) from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'accept_current_lister_terms') <> 1 then
    raise exception 'Unexpected Lister Terms acceptance overload remains.';
  end if;
end;
$$;

commit;
