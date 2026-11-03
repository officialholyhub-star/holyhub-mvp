-- Owner-only operation in the chosen Supabase SQL Editor AFTER migrations.
-- Replace the UUID with the intended administrator's existing verified Auth user.
-- This is not run automatically; there is no public admin-registration endpoint.
begin;
do $$
declare admin_id uuid := '00000000-0000-0000-0000-000000000000';
begin
  if admin_id = '00000000-0000-0000-0000-000000000000' then
    raise exception 'Set the verified administrator Auth user UUID first';
  end if;
  if not exists (
    select 1 from auth.users u join public.profiles p on p.id=u.id
    where u.id=admin_id and u.email_confirmed_at is not null and p.account_status='active'
  ) then raise exception 'Administrator must have an active profile and confirmed email'; end if;
  insert into public.user_roles(user_id,role) values(admin_id,'admin') on conflict do nothing;
  insert into public.audit_log(action,entity_id,detail)
    values('admin.bootstrapped',admin_id,'{"source":"owner SQL setup"}');
end $$;
commit;
