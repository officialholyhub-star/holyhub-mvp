-- C2: retain existing role membership and add MFA to admin branches of RLS.
-- Own-role reads remain available at AAL1 for MFA bootstrap. Customer/lister
-- role checks and their ownership policies are unchanged.
create or replace function private.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = required_role
  ) and (
    required_role <> 'admin'::public.app_role
    or (
      coalesce(auth.jwt()->>'aal', '') = 'aal2'
      and exists (
        select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) entry
        where entry->>'method' in ('totp', 'mfa/totp')
      )
    )
  );
$$;

revoke all on function private.has_role(public.app_role) from public;
grant execute on function private.has_role(public.app_role) to authenticated;
