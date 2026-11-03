-- Simple, admin-curated public events. No fixtures or automatic recurrence engine.
begin;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  organiser text not null check (char_length(trim(organiser)) between 2 and 120),
  location text not null check (char_length(trim(location)) between 2 and 160),
  schedule text not null check (char_length(trim(schedule)) between 5 and 180),
  description text not null check (char_length(trim(description)) between 30 and 3000),
  website_url text not null check (char_length(website_url) <= 500 and website_url ~ '^https?://[^[:space:]@/]+\.[^[:space:]@/]+'),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_discovery_idx on public.events(status, name, id);
alter table public.events enable row level security;
revoke all on public.events from public, anon, authenticated;
grant select on public.events to anon, authenticated;
create policy "published_events" on public.events for select to anon, authenticated
  using (status = 'published');
create policy "admin_events" on public.events for select to authenticated
  using (public.has_role('admin'));

create function public.save_event(payload jsonb)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare event_id uuid; current_event public.events;
begin
  if not public.has_role('admin') then raise exception 'Not authorised' using errcode='42501'; end if;
  if payload is null or jsonb_typeof(payload) <> 'object' then raise exception 'Invalid event'; end if;
  event_id := nullif(payload->>'id','')::uuid;
  if event_id is null then
    insert into public.events(name,organiser,location,schedule,description,website_url)
    values(trim(payload->>'name'),trim(payload->>'organiser'),trim(payload->>'location'),trim(payload->>'schedule'),trim(payload->>'description'),trim(payload->>'website_url'))
    returning id into event_id;
  else
    select * into current_event from public.events where id=event_id for update;
    if not found then raise exception 'Event not found'; end if;
    if current_event.updated_at is distinct from (payload->>'expected_updated_at')::timestamptz then
      raise exception 'This event changed. Reload before saving.' using errcode='40001';
    end if;
    update public.events set name=trim(payload->>'name'),organiser=trim(payload->>'organiser'),
      location=trim(payload->>'location'),schedule=trim(payload->>'schedule'),description=trim(payload->>'description'),
      website_url=trim(payload->>'website_url'),status='draft',updated_at=clock_timestamp() where id=event_id;
  end if;
  insert into public.audit_log(actor_id,action,entity_id,detail)
    values(auth.uid(),'event.saved',event_id,'{"status":"draft"}');
  return event_id;
end;
$$;

create function public.set_event_status(event_id uuid, decision text, expected_updated_at timestamptz)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not public.has_role('admin') then raise exception 'Not authorised' using errcode='42501'; end if;
  if decision is null or decision not in ('draft','published','archived') then raise exception 'Invalid event status'; end if;
  update public.events set status=decision,updated_at=clock_timestamp()
    where id=event_id and updated_at=expected_updated_at;
  if not found then return false; end if;
  insert into public.audit_log(actor_id,action,entity_id,detail)
    values(auth.uid(),'event.status_changed',event_id,jsonb_build_object('status',decision));
  return true;
end;
$$;
revoke all on function public.save_event(jsonb) from public, anon, authenticated;
revoke all on function public.set_event_status(uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.save_event(jsonb) to authenticated;
grant execute on function public.set_event_status(uuid,text,timestamptz) to authenticated;

-- Preserve the existing readiness flags while including the new feature schema.
create or replace function public.launch_readiness()
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select jsonb_build_object(
    'schema_version', 8,
    'schema_ready', (
      select count(*) = 7 and bool_and(c.relrowsecurity)
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname='public' and c.relname in ('profiles','user_roles','businesses','products','product_images','notifications','events')
    ) and exists(select 1 from public.platform_settings)
      and to_regprocedure('public.save_product(jsonb)') is not null
      and to_regprocedure('public.review_business(uuid,text,timestamp with time zone)') is not null
      and to_regprocedure('public.register_image(text,uuid,text)') is not null
      and to_regprocedure('public.save_event(jsonb)') is not null
      and to_regprocedure('public.set_event_status(uuid,text,timestamp with time zone)') is not null,
    'storage_ready', exists(select 1 from storage.buckets where id='product-images' and public=false and file_size_limit <= 5242880 and file_size_limit > 0),
    'admin_ready', exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id join auth.users u on u.id=r.user_id
      where r.role='admin' and p.account_status='active' and u.email_confirmed_at is not null)
  );
$$;
revoke all on function public.launch_readiness() from public;
grant execute on function public.launch_readiness() to anon, authenticated;
commit;
