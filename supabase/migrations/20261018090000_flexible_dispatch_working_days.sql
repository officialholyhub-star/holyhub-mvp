-- Let listers choose an exact number of working days for standard dispatch.
-- Legacy preset ranges remain valid for existing storefronts/orders.
-- Exact working-day values are kept in dispatch_custom_timeframe and frozen
-- into checkout/order snapshots like every other dispatch promise.

alter table public.lister_storefronts
  drop constraint if exists lister_storefronts_dispatch_window_check,
  drop constraint if exists lister_storefronts_dispatch_custom_check;

alter table public.lister_storefronts
  add constraint lister_storefronts_dispatch_window_check
    check (dispatch_window is null or dispatch_window in (
      '1-2-working-days', '2-3-working-days', '3-5-working-days', '5-7-working-days',
      'working-days', 'made-to-order'
    )),
  add constraint lister_storefronts_dispatch_custom_check
    check (
      (dispatch_window is null and dispatch_custom_timeframe is null)
      or (dispatch_window = 'working-days'
        and dispatch_custom_timeframe is not null
        and btrim(dispatch_custom_timeframe) ~ '^([1-9]|[12][0-9]|30)$')
      or (dispatch_window = 'made-to-order'
        and dispatch_custom_timeframe is not null
        and char_length(btrim(dispatch_custom_timeframe)) between 1 and 120)
      or (dispatch_window in ('1-2-working-days', '2-3-working-days', '3-5-working-days', '5-7-working-days')
        and dispatch_custom_timeframe is null)
    );

alter table public.checkout_session_sellers
  drop constraint if exists checkout_session_sellers_dispatch_window_check,
  drop constraint if exists checkout_session_sellers_dispatch_custom_check;

alter table public.checkout_session_sellers
  add constraint checkout_session_sellers_dispatch_window_check
    check (dispatch_window is null or dispatch_window in (
      '1-2-working-days', '2-3-working-days', '3-5-working-days', '5-7-working-days',
      'working-days', 'made-to-order'
    )),
  add constraint checkout_session_sellers_dispatch_custom_check
    check (
      (dispatch_window is null and dispatch_custom_timeframe is null)
      or (dispatch_window = 'working-days'
        and dispatch_custom_timeframe is not null
        and btrim(dispatch_custom_timeframe) ~ '^([1-9]|[12][0-9]|30)$')
      or (dispatch_window = 'made-to-order'
        and dispatch_custom_timeframe is not null
        and char_length(btrim(dispatch_custom_timeframe)) between 1 and 120)
      or (dispatch_window in ('1-2-working-days', '2-3-working-days', '3-5-working-days', '5-7-working-days')
        and dispatch_custom_timeframe is null)
    );

alter table public.seller_orders
  drop constraint if exists seller_orders_dispatch_window_check,
  drop constraint if exists seller_orders_dispatch_custom_check;

alter table public.seller_orders
  add constraint seller_orders_dispatch_window_check
    check (dispatch_window is null or dispatch_window in (
      '1-2-working-days', '2-3-working-days', '3-5-working-days', '5-7-working-days',
      'working-days', 'made-to-order'
    )),
  add constraint seller_orders_dispatch_custom_check
    check (
      (dispatch_window is null and dispatch_custom_timeframe is null)
      or (dispatch_window = 'working-days'
        and dispatch_custom_timeframe is not null
        and btrim(dispatch_custom_timeframe) ~ '^([1-9]|[12][0-9]|30)$')
      or (dispatch_window = 'made-to-order'
        and dispatch_custom_timeframe is not null
        and char_length(btrim(dispatch_custom_timeframe)) between 1 and 120)
      or (dispatch_window in ('1-2-working-days', '2-3-working-days', '3-5-working-days', '5-7-working-days')
        and dispatch_custom_timeframe is null)
    );

create or replace function public.seller_dispatch_is_ready(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lister_storefronts s
    where s.user_id = p_user_id
      and (
        s.dispatch_window in ('1-2-working-days', '2-3-working-days', '3-5-working-days', '5-7-working-days')
        or (
          s.dispatch_window = 'working-days'
          and btrim(s.dispatch_custom_timeframe) ~ '^([1-9]|[12][0-9]|30)$'
        )
        or (
          s.dispatch_window = 'made-to-order'
          and nullif(btrim(s.dispatch_custom_timeframe), '') is not null
          and char_length(btrim(s.dispatch_custom_timeframe)) <= 120
        )
      )
  );
$$;

revoke all on function public.seller_dispatch_is_ready(uuid) from public;
grant execute on function public.seller_dispatch_is_ready(uuid) to anon, authenticated;

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
    or (shop.dispatch_window in ('working-days', 'made-to-order') and nullif(btrim(shop.dispatch_custom_timeframe), '') is null)
    or (shop.dispatch_window = 'working-days' and btrim(shop.dispatch_custom_timeframe) !~ '^([1-9]|[12][0-9]|30)$') then
    raise exception 'Seller dispatch timeframe is not ready for checkout.';
  end if;

  select * into legal from public.seller_legal_profiles
  where user_id = new.lister_user_id and verification_status = 'verified';
  if not found then
    raise exception 'Seller legal identity is not verified for checkout.';
  end if;

  if new.seller_identity_profile_updated_at is distinct from legal.updated_at then
    raise exception 'Seller legal identity changed while checkout was being prepared.';
  end if;

  new.dispatch_window := shop.dispatch_window;
  new.dispatch_custom_timeframe := case
    when shop.dispatch_window in ('working-days', 'made-to-order') then btrim(shop.dispatch_custom_timeframe)
    else null
  end;

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
        when 'working-days' then
          'Dispatch within ' || so.dispatch_custom_timeframe || ' working '
          || case when so.dispatch_custom_timeframe = '1' then 'day' else 'days' end
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
      or (so.dispatch_window in ('working-days', 'made-to-order') and nullif(btrim(so.dispatch_custom_timeframe), '') is null)
      or (so.dispatch_window = 'working-days' and btrim(so.dispatch_custom_timeframe) !~ '^([1-9]|[12][0-9]|30)$')
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
