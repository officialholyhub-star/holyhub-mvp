-- C13 / A-164 / A-166: lightweight 18+ self-declaration for accounts, buying and selling.
-- This migration is forward-only. It does not backfill existing users as adults.

alter table public.profiles
  add column if not exists age_18_plus_confirmed_at timestamptz;

comment on column public.profiles.age_18_plus_confirmed_at is
  'Timestamp of the user''s HolyHub 18+ self-declaration. NULL means adult status has not been confirmed.';

-- New users receive an adult-confirmation timestamp only when the server-validated
-- signup flow supplied the explicit age self-declaration metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, age_18_plus_confirmed_at)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    case
      when coalesce(new.raw_user_meta_data ->> 'age_18_plus_confirmed', 'false') = 'true' then now()
      else null
    end
  );

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer');

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Deliberately do not grant authenticated UPDATE on age_18_plus_confirmed_at.
-- Existing accounts confirm through the protected server action instead.