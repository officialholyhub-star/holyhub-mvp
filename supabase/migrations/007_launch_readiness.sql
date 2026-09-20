-- Apply only after reviewing the target database and migrations 001-006.
-- No sample accounts, listings, products or orders are created here.
begin;

-- Only aggregate readiness flags are public: never IDs, names, email or secrets.
create function public.launch_readiness()
returns jsonb language sql stable security definer
set search_path = pg_catalog, public as $$
  select jsonb_build_object(
    'schema_version', 7,
    'schema_ready', (
      select count(*) = 6 and bool_and(c.relrowsecurity)
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname in ('profiles','user_roles','businesses','products','product_images','notifications')
    ) and exists(select 1 from public.platform_settings)
      and to_regprocedure('public.save_product(jsonb)') is not null
      and to_regprocedure('public.review_business(uuid,text,timestamp with time zone)') is not null
      and to_regprocedure('public.register_image(text,uuid,text)') is not null,
    'storage_ready', exists(
      select 1 from storage.buckets where id = 'product-images' and public = false
        and file_size_limit <= 5242880 and file_size_limit > 0
    ),
    'admin_ready', exists(
      select 1 from public.user_roles r
      join public.profiles p on p.id = r.user_id
      join auth.users u on u.id = r.user_id
      where r.role = 'admin' and p.account_status = 'active' and u.email_confirmed_at is not null
    )
  );
$$;
revoke all on function public.launch_readiness() from public;
grant execute on function public.launch_readiness() to anon, authenticated;

-- Alert human reviewers in their account whenever a business enters review.
create function public.notify_business_submission()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public as $$
begin
  if new.status = 'pending' then
    insert into public.notifications(user_id, message, href)
      select r.user_id, 'A business application is ready for review: ' || new.name, '/admin'
      from public.user_roles r join public.profiles p on p.id = r.user_id
      where r.role = 'admin' and p.account_status = 'active';
  end if;
  return new;
end;
$$;
revoke all on function public.notify_business_submission() from public, anon, authenticated;
create trigger business_submission_notification
after insert or update on public.businesses
for each row execute function public.notify_business_submission();
commit;
