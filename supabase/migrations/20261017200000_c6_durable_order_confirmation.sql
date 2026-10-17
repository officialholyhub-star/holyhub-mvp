-- C6: durable-medium order-confirmation foundation.
-- Forward-only. No historical orders are backfilled or emailed by this migration.
-- Depends on 026_seller_legal_identity.sql.

-- Capture the seller's promised dispatch window before purchase. Existing shops
-- remain nullable until they are reviewed/backfilled; new checkout snapshots fail
-- closed if the promise is missing.
alter table public.lister_storefronts
  add column dispatch_window text,
  add column dispatch_custom_timeframe text;

alter table public.lister_storefronts
  add constraint lister_storefronts_dispatch_window_check
    check (dispatch_window is null or dispatch_window in (
      '1-2-working-days', '2-3-working-days', '3-5-working-days', '5-7-working-days', 'made-to-order'
    )),
  add constraint lister_storefronts_dispatch_custom_check
    check (
      (dispatch_window is null and dispatch_custom_timeframe is null)
      or (dispatch_window = 'made-to-order'
        and dispatch_custom_timeframe is not null
        and char_length(btrim(dispatch_custom_timeframe)) between 1 and 120)
      or (dispatch_window in ('1-2-working-days', '2-3-working-days', '3-5-working-days', '5-7-working-days')
        and dispatch_custom_timeframe is null)
    );

grant insert (dispatch_window, dispatch_custom_timeframe) on public.lister_storefronts to authenticated;
grant update (dispatch_window, dispatch_custom_timeframe) on public.lister_storefronts to authenticated;

alter table public.checkout_sessions
  add column customer_email text
    check (customer_email is null or char_length(customer_email) between 3 and 254);

alter table public.checkout_session_sellers
  add column dispatch_window text,
  add column dispatch_custom_timeframe text;

alter table public.checkout_session_sellers
  add constraint checkout_session_sellers_dispatch_window_check
    check (dispatch_window is null or dispatch_window in (
      '1-2-working-days', '2-3-working-days', '3-5-working-days', '5-7-working-days', 'made-to-order'
    )),
  add constraint checkout_session_sellers_dispatch_custom_check
    check (
      (dispatch_window is null and dispatch_custom_timeframe is null)
      or (dispatch_window = 'made-to-order'
        and dispatch_custom_timeframe is not null
        and char_length(btrim(dispatch_custom_timeframe)) between 1 and 120)
      or (dispatch_window in ('1-2-working-days', '2-3-working-days', '3-5-working-days', '5-7-working-days')
        and dispatch_custom_timeframe is null)
    );

alter table public.orders
  add column customer_email text
    check (customer_email is null or char_length(customer_email) between 3 and 254);

-- Preserve the complete seller/trader identity that applied to each seller
-- portion. Historical seller orders remain nullable; new rows are populated from
-- the checkout snapshot by a trigger below.
alter table public.seller_orders
  add column seller_legal_name text,
  add column seller_entity_type text,
  add column seller_address_line1 text,
  add column seller_address_line2 text,
  add column seller_city text,
  add column seller_postcode text,
  add column seller_country text,
  add column seller_service_address_line1 text,
  add column seller_service_address_line2 text,
  add column seller_service_address_city text,
  add column seller_service_address_postcode text,
  add column seller_service_address_country text,
  add column seller_contact_email text,
  add column seller_contact_phone text,
  add column seller_registration_number text,
  add column seller_registration_jurisdiction text,
  add column seller_registered_office_line1 text,
  add column seller_registered_office_line2 text,
  add column seller_registered_office_city text,
  add column seller_registered_office_postcode text,
  add column seller_registered_office_country text,
  add column seller_vat_number text,
  add column seller_identity_verified_at timestamptz,
  add column seller_identity_profile_updated_at timestamptz,
  add column dispatch_window text,
  add column dispatch_custom_timeframe text;

alter table public.seller_orders
  add constraint seller_orders_entity_type_check
    check (seller_entity_type is null or seller_entity_type in ('sole_trader', 'limited_company', 'llp', 'partnership', 'charity_nonprofit', 'other')),
  add constraint seller_orders_dispatch_window_check
    check (dispatch_window is null or dispatch_window in (
      '1-2-working-days', '2-3-working-days', '3-5-working-days', '5-7-working-days', 'made-to-order'
    )),
  add constraint seller_orders_dispatch_custom_check
    check (
      (dispatch_window is null and dispatch_custom_timeframe is null)
      or (dispatch_window = 'made-to-order'
        and dispatch_custom_timeframe is not null
        and char_length(btrim(dispatch_custom_timeframe)) between 1 and 120)
      or (dispatch_window in ('1-2-working-days', '2-3-working-days', '3-5-working-days', '5-7-working-days')
        and dispatch_custom_timeframe is null)
    );

-- Resolve the account email server-side when the checkout record is written. The
-- browser/Stripe metadata is never the source of truth for the confirmation
-- recipient.
create or replace function private.snapshot_checkout_customer_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_email text;
begin
  select lower(btrim(u.email)) into resolved_email
  from auth.users u
  where u.id = new.user_id;

  if resolved_email is null
    or char_length(resolved_email) not between 3 and 254
    or resolved_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Customer account email is unavailable for order confirmation.';
  end if;

  new.customer_email := resolved_email;
  return new;
end;
$$;

revoke all on function private.snapshot_checkout_customer_email() from public;

drop trigger if exists checkout_sessions_snapshot_customer_email on public.checkout_sessions;
create trigger checkout_sessions_snapshot_customer_email
before insert on public.checkout_sessions
for each row execute function private.snapshot_checkout_customer_email();

-- Freeze the approved dispatch promise and independently re-check the verified
-- seller profile version at the point the checkout contract snapshot is stored.
create or replace function private.complete_checkout_seller_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  shop public.lister_storefronts;
  legal public.seller_legal_profiles;
begin
  select * into shop from public.lister_storefronts where user_id = new.lister_user_id;
  if not found or shop.dispatch_window is null
    or (shop.dispatch_window = 'made-to-order' and nullif(btrim(shop.dispatch_custom_timeframe), '') is null) then
    raise exception 'Seller dispatch timeframe is not ready for checkout.';
  end if;

  select * into legal from public.seller_legal_profiles
  where user_id = new.lister_user_id and verification_status = 'verified';
  if not found then
    raise exception 'Seller legal identity is not verified for checkout.';
  end if;

  -- The application already reads and version-checks this profile. Reject a
  -- race rather than silently changing the trader details after checkout prep.
  if new.seller_identity_profile_updated_at is distinct from legal.updated_at then
    raise exception 'Seller legal identity changed while checkout was being prepared.';
  end if;

  new.dispatch_window := shop.dispatch_window;
  new.dispatch_custom_timeframe := case when shop.dispatch_window = 'made-to-order' then btrim(shop.dispatch_custom_timeframe) else null end;

  new.seller_legal_name := legal.legal_name;
  new.seller_entity_type := legal.entity_type;
  new.seller_address_line1 := legal.address_line1;
  new.seller_address_line2 := legal.address_line2;
  new.seller_city := legal.city;
  new.seller_postcode := legal.postcode;
  new.seller_country := legal.country;
  new.seller_service_address_line1 := legal.service_address_line1;
  new.seller_service_address_line2 := legal.service_address_line2;
  new.seller_service_address_city := legal.service_address_city;
  new.seller_service_address_postcode := legal.service_address_postcode;
  new.seller_service_address_country := legal.service_address_country;
  new.seller_contact_email := legal.contact_email;
  new.seller_contact_phone := legal.contact_phone;
  new.seller_registration_number := legal.registration_number;
  new.seller_registration_jurisdiction := legal.registration_jurisdiction;
  new.seller_registered_office_line1 := legal.registered_office_line1;
  new.seller_registered_office_line2 := legal.registered_office_line2;
  new.seller_registered_office_city := legal.registered_office_city;
  new.seller_registered_office_postcode := legal.registered_office_postcode;
  new.seller_registered_office_country := legal.registered_office_country;
  new.seller_vat_number := legal.vat_number;
  new.seller_identity_verified_at := legal.verified_at;
  new.seller_identity_profile_updated_at := legal.updated_at;
  return new;
end;
$$;

revoke all on function private.complete_checkout_seller_snapshot() from public;

drop trigger if exists checkout_session_sellers_complete_snapshot on public.checkout_session_sellers;
create trigger checkout_session_sellers_complete_snapshot
before insert on public.checkout_session_sellers
for each row execute function private.complete_checkout_seller_snapshot();

-- Copy the account-email snapshot into the durable paid-order record without
-- changing the historical process_checkout_payment migration.
create or replace function private.copy_order_customer_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.checkout_session_id is not null then
    select c.customer_email into new.customer_email
    from public.checkout_sessions c
    where c.id = new.checkout_session_id;
  end if;
  return new;
end;
$$;

revoke all on function private.copy_order_customer_email() from public;

drop trigger if exists orders_copy_customer_email on public.orders;
create trigger orders_copy_customer_email
before insert on public.orders
for each row execute function private.copy_order_customer_email();

-- Copy the immutable seller/trader + dispatch snapshot into each seller portion.
create or replace function private.copy_seller_order_contract_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  snap public.checkout_session_sellers;
begin
  select s.* into snap
  from public.checkout_session_sellers s
  join public.orders o on o.checkout_session_id = s.checkout_session_id
  where o.id = new.order_id and s.lister_user_id = new.seller_user_id;

  if found then
    new.seller_legal_name := snap.seller_legal_name;
    new.seller_entity_type := snap.seller_entity_type;
    new.seller_address_line1 := snap.seller_address_line1;
    new.seller_address_line2 := snap.seller_address_line2;
    new.seller_city := snap.seller_city;
    new.seller_postcode := snap.seller_postcode;
    new.seller_country := snap.seller_country;
    new.seller_service_address_line1 := snap.seller_service_address_line1;
    new.seller_service_address_line2 := snap.seller_service_address_line2;
    new.seller_service_address_city := snap.seller_service_address_city;
    new.seller_service_address_postcode := snap.seller_service_address_postcode;
    new.seller_service_address_country := snap.seller_service_address_country;
    new.seller_contact_email := snap.seller_contact_email;
    new.seller_contact_phone := snap.seller_contact_phone;
    new.seller_registration_number := snap.seller_registration_number;
    new.seller_registration_jurisdiction := snap.seller_registration_jurisdiction;
    new.seller_registered_office_line1 := snap.seller_registered_office_line1;
    new.seller_registered_office_line2 := snap.seller_registered_office_line2;
    new.seller_registered_office_city := snap.seller_registered_office_city;
    new.seller_registered_office_postcode := snap.seller_registered_office_postcode;
    new.seller_registered_office_country := snap.seller_registered_office_country;
    new.seller_vat_number := snap.seller_vat_number;
    new.seller_identity_verified_at := snap.seller_identity_verified_at;
    new.seller_identity_profile_updated_at := snap.seller_identity_profile_updated_at;
    new.dispatch_window := snap.dispatch_window;
    new.dispatch_custom_timeframe := snap.dispatch_custom_timeframe;
  end if;

  return new;
end;
$$;

revoke all on function private.copy_seller_order_contract_snapshot() from public;

drop trigger if exists seller_orders_copy_contract_snapshot on public.seller_orders;
create trigger seller_orders_copy_contract_snapshot
before insert on public.seller_orders
for each row execute function private.copy_seller_order_contract_snapshot();

-- Durable provider-neutral queue. Sending remains disabled until a transactional
-- provider, sender domain, secrets, worker and delivery webhook are configured.
create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique check (char_length(dedupe_key) between 1 and 300),
  kind text not null check (kind = 'customer_order_confirmation'),
  template_version integer not null default 1 check (template_version > 0),
  order_id uuid not null references public.orders(id) on delete restrict,
  recipient_email text check (recipient_email is null or char_length(recipient_email) between 3 and 254),
  payload jsonb not null,
  state text not null check (state in ('pending', 'processing', 'sent', 'failed', 'blocked', 'unknown')),
  block_reason text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  provider_message_id text,
  delivery_status text,
  delivered_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_outbox_ready_idx
on public.notification_outbox (state, next_attempt_at, created_at)
where state in ('pending', 'processing');

alter table public.notification_outbox enable row level security;
revoke all on table public.notification_outbox from public, anon, authenticated;
grant select, insert, update on public.notification_outbox to service_role;

create table public.notification_attempts (
  id bigint generated always as identity primary key,
  outbox_id uuid not null references public.notification_outbox(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  outcome text not null check (outcome in ('accepted', 'temporary_failure', 'permanent_failure', 'unknown')),
  provider_message_id text,
  error_code text,
  attempted_at timestamptz not null default now(),
  unique (outbox_id, attempt_number)
);

alter table public.notification_attempts enable row level security;
revoke all on table public.notification_attempts from public, anon, authenticated;
grant select, insert on public.notification_attempts to service_role;

-- Queue exactly one confirmation after the paid order transaction reaches its
-- final checkout-status transition. Incomplete legal/dispatch data creates a
-- visible blocked job rather than rolling back an already-paid customer order.
create or replace function private.enqueue_customer_order_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ord public.orders;
  sellers_payload jsonb;
  missing_reason text := null;
begin
  if old.status is not distinct from new.status or new.status <> 'paid' then
    return new;
  end if;

  select * into ord
  from public.orders
  where checkout_session_id = new.id;

  if not found then
    return new;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'sellerOrderId', so.id,
      'sellerUserId', so.seller_user_id,
      'sellerBusinessName', so.seller_business_name,
      'sellerLegalName', so.seller_legal_name,
      'sellerEntityType', so.seller_entity_type,
      'sellerGeographicalAddress', jsonb_build_object(
        'line1', so.seller_address_line1, 'line2', so.seller_address_line2,
        'city', so.seller_city, 'postcode', so.seller_postcode, 'country', so.seller_country
      ),
      'sellerServiceAddress', case when so.seller_service_address_line1 is null then null else jsonb_build_object(
        'line1', so.seller_service_address_line1, 'line2', so.seller_service_address_line2,
        'city', so.seller_service_address_city, 'postcode', so.seller_service_address_postcode,
        'country', so.seller_service_address_country
      ) end,
      'sellerContactEmail', so.seller_contact_email,
      'sellerTelephone', so.seller_contact_phone,
      'registrationNumber', so.seller_registration_number,
      'registrationJurisdiction', so.seller_registration_jurisdiction,
      'registeredOffice', case when so.seller_registered_office_line1 is null then null else jsonb_build_object(
        'line1', so.seller_registered_office_line1, 'line2', so.seller_registered_office_line2,
        'city', so.seller_registered_office_city, 'postcode', so.seller_registered_office_postcode,
        'country', so.seller_registered_office_country
      ) end,
      'vatNumber', so.seller_vat_number,
      'dispatchWindow', so.dispatch_window,
      'dispatchCustomTimeframe', so.dispatch_custom_timeframe,
      'deliveryTerms', case so.dispatch_window
        when '1-2-working-days' then 'Dispatch within 1–2 working days'
        when '2-3-working-days' then 'Dispatch within 2–3 working days'
        when '3-5-working-days' then 'Dispatch within 3–5 working days'
        when '5-7-working-days' then 'Dispatch within 5–7 working days'
        when 'made-to-order' then 'Made to order — ' || coalesce(so.dispatch_custom_timeframe, '')
        else null
      end,
      'deliveryAmount', so.delivery_total,
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'productName', oi.product_name,
          'variantSize', oi.variant_size,
          'quantity', oi.quantity,
          'unitAmount', oi.unit_amount,
          'lineTotal', oi.line_total
        ) order by oi.id)
        from public.order_items oi
        where oi.order_id = so.order_id and oi.seller_user_id = so.seller_user_id
      ), '[]'::jsonb)
    ) order by so.id
  ), '[]'::jsonb)
  into sellers_payload
  from public.seller_orders so
  where so.order_id = ord.id;

  if ord.customer_email is null or ord.customer_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    missing_reason := 'missing_customer_email';
  elsif ord.delivery_address_line1 is null or ord.delivery_city is null or ord.delivery_postcode is null or ord.delivery_country is null then
    missing_reason := 'missing_delivery_address';
  elsif not exists (select 1 from public.seller_orders so where so.order_id = ord.id) then
    missing_reason := 'missing_seller';
  elsif exists (
    select 1 from public.seller_orders so
    where so.order_id = ord.id and (
      so.seller_legal_name is null or so.seller_address_line1 is null or so.seller_city is null
      or so.seller_postcode is null or so.seller_country is null or so.seller_contact_email is null
    )
  ) then
    missing_reason := 'missing_seller_identity';
  elsif exists (
    select 1 from public.seller_orders so
    where so.order_id = ord.id and (
      so.dispatch_window is null
      or (so.dispatch_window = 'made-to-order' and nullif(btrim(so.dispatch_custom_timeframe), '') is null)
    )
  ) then
    missing_reason := 'missing_dispatch_terms';
  elsif exists (
    select 1 from public.seller_orders so
    where so.order_id = ord.id
      and not exists (select 1 from public.order_items oi where oi.order_id = ord.id and oi.seller_user_id = so.seller_user_id)
  ) then
    missing_reason := 'missing_item';
  end if;

  insert into public.notification_outbox (
    dedupe_key, kind, template_version, order_id, recipient_email, payload, state, block_reason, next_attempt_at
  ) values (
    'order:' || ord.id::text || ':customer-confirmation:v1',
    'customer_order_confirmation',
    1,
    ord.id,
    ord.customer_email,
    jsonb_build_object(
      'orderId', ord.id,
      'orderDateIso', coalesce(ord.paid_at, ord.created_at),
      'customerEmail', ord.customer_email,
      'currency', ord.currency,
      'productSubtotal', ord.product_subtotal,
      'deliveryTotal', ord.delivery_total,
      'totalAmount', ord.total_amount,
      'deliveryAddress', jsonb_build_object(
        'recipientName', ord.delivery_recipient_name,
        'line1', ord.delivery_address_line1,
        'line2', ord.delivery_address_line2,
        'city', ord.delivery_city,
        'postcode', ord.delivery_postcode,
        'country', ord.delivery_country
      ),
      'sellers', sellers_payload,
      'marketplaceRoleText', 'HolyHub is the marketplace connecting customers with independent Christian brands. Products are supplied and sold by the named seller, while HolyHub provides the marketplace, checkout and support experience.',
      'templateVersion', 1
    ),
    case when missing_reason is null then 'pending' else 'blocked' end,
    missing_reason,
    case when missing_reason is null then now() else null end
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

revoke all on function private.enqueue_customer_order_confirmation() from public;

drop trigger if exists checkout_sessions_enqueue_customer_confirmation on public.checkout_sessions;
create trigger checkout_sessions_enqueue_customer_confirmation
after update of status on public.checkout_sessions
for each row execute function private.enqueue_customer_order_confirmation();
