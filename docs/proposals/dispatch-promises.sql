-- PROPOSAL v2 ONLY: do not execute without explicit approval.
-- No RLS policies, amounts, statuses, stock routines or Stripe API calls change.
-- This is deliberately outside supabase/migrations and has NOT been applied.
begin;

alter table public.lister_storefronts
  add column dispatch_min_working_days smallint,
  add column dispatch_max_working_days smallint,
  add column dispatch_made_to_order boolean,
  add column transit_min_working_days smallint,
  add column transit_max_working_days smallint,
  add constraint storefront_dispatch_range check (
    (dispatch_min_working_days is null and dispatch_max_working_days is null and dispatch_made_to_order is null)
    or (dispatch_min_working_days is not null and dispatch_max_working_days is not null and dispatch_made_to_order is not null
      and dispatch_min_working_days between 1 and 365 and dispatch_max_working_days between dispatch_min_working_days and 365)),
  add constraint storefront_transit_range check (
    (transit_min_working_days is null and transit_max_working_days is null)
    or (transit_min_working_days is not null and transit_max_working_days is not null
      and transit_min_working_days between 1 and 365 and transit_max_working_days between transit_min_working_days and 365));
grant insert (dispatch_min_working_days, dispatch_max_working_days, dispatch_made_to_order, transit_min_working_days, transit_max_working_days),
  update (dispatch_min_working_days, dispatch_max_working_days, dispatch_made_to_order, transit_min_working_days, transit_max_working_days)
  on public.lister_storefronts to authenticated;
-- Existing public SELECT and own-lister INSERT/UPDATE RLS stay unchanged.

-- Typed, nullable snapshots: old checkouts/orders remain entirely unknown.
alter table public.checkout_session_sellers
  add column dispatch_promise_version smallint,
  add column dispatch_min_working_days smallint,
  add column dispatch_max_working_days smallint,
  add column dispatch_made_to_order boolean,
  add column transit_min_working_days smallint,
  add column transit_max_working_days smallint,
  add column dispatch_promise_captured_at timestamptz,
  add constraint checkout_session_sellers_dispatch_snapshot check (
    (dispatch_promise_version is null and dispatch_min_working_days is null and dispatch_max_working_days is null and dispatch_made_to_order is null and transit_min_working_days is null and transit_max_working_days is null and dispatch_promise_captured_at is null)
    or (dispatch_promise_version is not null and dispatch_promise_version = 1
      and dispatch_min_working_days is not null and dispatch_max_working_days is not null
      and dispatch_made_to_order is not null and dispatch_promise_captured_at is not null
      and isfinite(dispatch_promise_captured_at)
      and dispatch_min_working_days between 1 and 365
      and dispatch_max_working_days between dispatch_min_working_days and 365
      and ((transit_min_working_days is null and transit_max_working_days is null)
        or (transit_min_working_days is not null and transit_max_working_days is not null
          and transit_min_working_days between 1 and 365
          and transit_max_working_days between transit_min_working_days and 365))));
grant insert (dispatch_promise_version, dispatch_min_working_days, dispatch_max_working_days, dispatch_made_to_order, transit_min_working_days, transit_max_working_days, dispatch_promise_captured_at) on public.checkout_session_sellers to service_role;

-- Typed, nullable snapshots: old checkouts/orders remain entirely unknown.
alter table public.seller_orders
  add column dispatch_promise_version smallint,
  add column dispatch_min_working_days smallint,
  add column dispatch_max_working_days smallint,
  add column dispatch_made_to_order boolean,
  add column transit_min_working_days smallint,
  add column transit_max_working_days smallint,
  add column dispatch_promise_captured_at timestamptz,
  add constraint seller_orders_dispatch_snapshot check (
    (dispatch_promise_version is null and dispatch_min_working_days is null and dispatch_max_working_days is null and dispatch_made_to_order is null and transit_min_working_days is null and transit_max_working_days is null and dispatch_promise_captured_at is null)
    or (dispatch_promise_version is not null and dispatch_promise_version = 1
      and dispatch_min_working_days is not null and dispatch_max_working_days is not null
      and dispatch_made_to_order is not null and dispatch_promise_captured_at is not null
      and isfinite(dispatch_promise_captured_at)
      and dispatch_min_working_days between 1 and 365
      and dispatch_max_working_days between dispatch_min_working_days and 365
      and ((transit_min_working_days is null and transit_max_working_days is null)
        or (transit_min_working_days is not null and transit_max_working_days is not null
          and transit_min_working_days between 1 and 365
          and transit_max_working_days between transit_min_working_days and 365))));
grant insert (dispatch_promise_version, dispatch_min_working_days, dispatch_max_working_days, dispatch_made_to_order, transit_min_working_days, transit_max_working_days, dispatch_promise_captured_at) on public.seller_orders to service_role;

alter table public.seller_orders
  add column dispatch_confirmed_at timestamptz,
  add column dispatch_confirmation_event_id text,
  add column dispatch_due_at timestamptz,
  add constraint seller_orders_dispatch_confirmation check (
    (dispatch_confirmed_at is null and dispatch_confirmation_event_id is null and dispatch_due_at is null)
    or (dispatch_confirmed_at is not null and isfinite(dispatch_confirmed_at)
      and dispatch_confirmation_event_id is not null and dispatch_confirmation_event_id ~ '^evt_[A-Za-z0-9]+$'
      and dispatch_due_at is not null and isfinite(dispatch_due_at)
      and dispatch_promise_version is not null and dispatch_promise_version = 1
      and dispatch_due_at > dispatch_confirmed_at));
-- No snapshot UPDATE grant: ordinary listers cannot rewrite purchase promises.
-- Server may set only the timing fields; the RPC below fills them once.
grant select (order_id, order_status, dispatch_promise_version, dispatch_promise_captured_at, dispatch_max_working_days, dispatch_due_at)
  on public.seller_orders to service_role;
grant update (dispatch_confirmed_at, dispatch_confirmation_event_id, dispatch_due_at)
  on public.seller_orders to service_role;
create index seller_orders_dispatch_attention_idx on public.seller_orders(dispatch_due_at)
  where fulfilment_status in ('pending', 'packed') and dispatch_due_at is not null;

-- No JSON casts. No exceptions for absent/invalid optional inputs.
-- Monday-Friday, Europe/London, final day inclusive; bank holidays not excluded.
create function private.holyhub_dispatch_deadline(confirmed_at timestamptz, working_days integer)
returns timestamptz language plpgsql stable security invoker set search_path = '' as $$
declare
  day_cursor date;
  remaining integer := working_days;
begin
  if confirmed_at is null or not isfinite(confirmed_at) or working_days is null
    or working_days < 1 or working_days > 365 then return null; end if;
  day_cursor := (confirmed_at at time zone 'Europe/London')::date;
  while remaining > 0 loop
    day_cursor := day_cursor + 1;
    if extract(isodow from day_cursor) < 6 then remaining := remaining - 1; end if;
  end loop;
  return (day_cursor + 1)::timestamp at time zone 'Europe/London';
end;
$$;
revoke all on function private.holyhub_dispatch_deadline(timestamptz, integer) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.holyhub_dispatch_deadline(timestamptz, integer) to service_role;

-- Separate AFTER-COMMIT enrichment. Never called instead of payment processing.
-- Caller must first verify a signed paid Checkout event for this exact session.
-- The event time is a Stripe confirmation-event timestamp, not HTTP receipt time.
create function public.record_order_dispatch_confirmation(
  p_order_id uuid, p_stripe_session_id text, p_confirmed_at timestamptz, p_event_id text
)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  updated_count integer := 0;
begin
  if current_user <> 'service_role' then
    raise exception 'Service access is required.' using errcode = '42501';
  end if;
  if p_order_id is null or p_stripe_session_id is null
    or p_confirmed_at is null or not isfinite(p_confirmed_at)
    or p_confirmed_at > statement_timestamp() + interval '5 minutes'
    or p_event_id is null or p_event_id !~ '^evt_[A-Za-z0-9]+$' then return 0; end if;
  -- Serialize competing confirmation deliveries. Do not lock checkout in reverse
  -- order to the existing payment function. Historical orders are never filled.
  perform o.id from public.orders o
    where o.id = p_order_id and o.stripe_checkout_session_id = p_stripe_session_id
      and o.order_status = 'paid'
      and exists (select 1 from public.checkout_sessions c
        where c.id = o.checkout_session_id and c.stripe_checkout_session_id = p_stripe_session_id
          and c.status = 'paid')
    for update;
  if not found then return 0; end if;
  update public.seller_orders so
    set dispatch_confirmed_at = p_confirmed_at,
        dispatch_confirmation_event_id = p_event_id,
        dispatch_due_at = private.holyhub_dispatch_deadline(p_confirmed_at, so.dispatch_max_working_days)
    where so.order_id = p_order_id and so.order_status = 'paid'
      and so.dispatch_promise_version = 1 and so.dispatch_due_at is null
      -- Reject unrelated/implausibly early events; tolerate small clock skew.
      and p_confirmed_at >= so.dispatch_promise_captured_at - interval '5 minutes';
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;
revoke all on function public.record_order_dispatch_confirmation(uuid, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.record_order_dispatch_confirmation(uuid, text, timestamptz, text) to service_role;

-- Existing seven-argument API remains intact for webhook AND success-page
-- reconciliation. Only copy typed seller terms into NEW seller_orders rows.
-- Do not compute deadlines, parse JSON or consult current shop settings here.
create or replace function public.process_checkout_payment(
  p_stripe_session_id text,
  p_status text,
  p_payment_status text,
  p_amount_total integer,
  p_currency text,
  p_payment_intent_id text,
  p_delivery_address jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  checkout public.checkout_sessions;
  saved_order public.orders;
  saved_order_id uuid;
  item_subtotal bigint;
  seller_delivery_total bigint;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Service access is required.' using errcode = '42501';
  end if;
  if p_stripe_session_id is null or length(p_stripe_session_id) not between 1 and 255
    or p_status is null or p_status not in ('paid', 'cancelled', 'failed') then
    raise exception 'Invalid checkout payment identifiers.';
  end if;
  -- Serialize both duplicate success and out-of-order terminal events.
  select * into checkout from public.checkout_sessions
  where stripe_checkout_session_id = p_stripe_session_id for update;
  if not found then raise exception 'Checkout snapshot not found.'; end if;

  if p_status <> 'paid' then
    if checkout.status = 'paid' then
      return (select id from public.orders where stripe_checkout_session_id = p_stripe_session_id);
    end if;
    update public.checkout_sessions set status = p_status::public.checkout_status,
      payment_intent_id = coalesce(p_payment_intent_id, payment_intent_id), updated_at = now()
    where id = checkout.id;
    perform public.release_checkout_variant_reservations(checkout.id);
    return null;
  end if;

  if p_payment_status is distinct from 'paid' or p_currency is distinct from 'gbp'
    or p_amount_total is null or p_amount_total <> checkout.amount_total
    or checkout.product_subtotal::bigint + checkout.delivery_total <> checkout.amount_total
    or checkout.holyhub_commission::bigint + checkout.seller_amount_total <> checkout.product_subtotal
    or checkout.holyhub_commission <> round(checkout.product_subtotal::numeric / 20)::integer then
    raise exception 'Payment does not match the checkout snapshot.';
  end if;
  if p_delivery_address is null or jsonb_typeof(p_delivery_address) <> 'object'
    or exists (select 1 from jsonb_each(p_delivery_address) entry
      where jsonb_typeof(entry.value) not in ('string', 'null') or length(entry.value #>> '{}') > 1000)
    or (p_delivery_address->>'delivery_country' is not null and p_delivery_address->>'delivery_country' <> 'GB') then
    raise exception 'Invalid delivery address snapshot.';
  end if;

  -- Snapshots are server-owned. Lock them before validating and copying.
  perform id from public.checkout_session_items where checkout_session_id = checkout.id order by id for update;
  perform lister_user_id from public.checkout_session_sellers where checkout_session_id = checkout.id order by lister_user_id for update;
  select sum(line_total) into item_subtotal from public.checkout_session_items where checkout_session_id = checkout.id;
  select sum(delivery_total) into seller_delivery_total from public.checkout_session_sellers where checkout_session_id = checkout.id;
  if item_subtotal is distinct from checkout.product_subtotal::bigint
    or seller_delivery_total is distinct from checkout.delivery_total::bigint
    or exists (select 1 from public.checkout_session_items i where i.checkout_session_id = checkout.id
      and (i.product_id is null or not exists (select 1 from public.checkout_session_sellers s
        where s.checkout_session_id = checkout.id and s.lister_user_id = i.lister_user_id)))
    or exists (select 1 from public.checkout_session_sellers s where s.checkout_session_id = checkout.id
      and not exists (select 1 from public.checkout_session_items i
        where i.checkout_session_id = checkout.id and i.lister_user_id = s.lister_user_id))
    or exists (select 1 from public.checkout_session_items where checkout_session_id = checkout.id
      group by product_id, variant_size having count(*) > 1) then
    raise exception 'Incomplete or inconsistent checkout snapshots.';
  end if;

  -- Consistent product/variant lock order also protects overlapping multi-seller
  -- checkouts. Stock checks and decrements remain in the existing guarded RPC.
  perform p.id from public.products p where p.id in (
    select product_id from public.checkout_session_items where checkout_session_id = checkout.id
  ) order by p.id for update;
  perform v.id from public.product_variants v where v.product_id in (
    select product_id from public.checkout_session_items where checkout_session_id = checkout.id
  ) order by v.id for update;
  if exists (select 1 from public.checkout_session_items i
    left join public.products p on p.id = i.product_id
    left join public.product_variants v on v.id = i.variant_id
    where i.checkout_session_id = checkout.id and (
      p.id is null or p.lister_user_id <> i.lister_user_id
      or (i.variant_id is not null and (v.id is null or v.product_id <> i.product_id or v.size is distinct from i.variant_size))
    )) then
    raise exception 'Invalid product or variant snapshot.';
  end if;

  select * into saved_order from public.orders where stripe_checkout_session_id = p_stripe_session_id;
  if found then
    -- Preserve existing valid orders and fulfilment progress. Missing children
    -- from an old partial write can be added below without rewriting any rows.
    if saved_order.user_id <> checkout.user_id or saved_order.checkout_session_id is distinct from checkout.id
      or saved_order.product_subtotal <> checkout.product_subtotal or saved_order.delivery_total <> checkout.delivery_total
      or saved_order.total_amount <> checkout.amount_total or saved_order.holyhub_commission <> checkout.holyhub_commission
      or saved_order.seller_amount_total <> checkout.seller_amount_total then
      raise exception 'Existing order does not match checkout.';
    end if;
    saved_order_id := saved_order.id;
  else
    insert into public.orders (user_id, checkout_session_id, stripe_checkout_session_id,
      order_status, fulfilment_status, currency, product_subtotal, delivery_total, total_amount,
      holyhub_commission, seller_amount_total, delivery_recipient_name, delivery_address_line1,
      delivery_address_line2, delivery_city, delivery_postcode, delivery_country, paid_at)
    values (checkout.user_id, checkout.id, p_stripe_session_id, 'paid', 'pending', 'GBP',
      checkout.product_subtotal, checkout.delivery_total, checkout.amount_total, checkout.holyhub_commission,
      checkout.seller_amount_total, p_delivery_address->>'delivery_recipient_name',
      p_delivery_address->>'delivery_address_line1', p_delivery_address->>'delivery_address_line2',
      p_delivery_address->>'delivery_city', p_delivery_address->>'delivery_postcode',
      p_delivery_address->>'delivery_country', now()) returning id into saved_order_id;
  end if;

  if exists (select 1 from public.order_items oi where oi.order_id = saved_order_id
    and not exists (select 1 from public.checkout_session_items i where i.checkout_session_id = checkout.id
      and i.product_id = oi.product_id and i.variant_id is not distinct from oi.variant_id
      and i.lister_user_id = oi.seller_user_id and i.product_name = oi.product_name
      and i.unit_amount = oi.unit_amount and i.quantity = oi.quantity and i.line_total = oi.line_total
      and i.variant_size is not distinct from oi.variant_size)) then
    raise exception 'Existing order items do not match checkout.';
  end if;
  insert into public.order_items (order_id, product_id, seller_user_id, product_name,
    unit_amount, quantity, line_total, variant_id, variant_size)
  select saved_order_id, product_id, lister_user_id, product_name, unit_amount, quantity, line_total, variant_id, variant_size
  from public.checkout_session_items where checkout_session_id = checkout.id
  on conflict on constraint order_items_order_product_size_unique do nothing;

  if exists (select 1 from public.seller_orders so where so.order_id = saved_order_id
    and not exists (select 1 from public.checkout_session_sellers s where s.checkout_session_id = checkout.id
      and s.lister_user_id = so.seller_user_id and s.delivery_total = so.delivery_total
      and so.product_subtotal = (select sum(i.line_total) from public.checkout_session_items i
        where i.checkout_session_id = checkout.id and i.lister_user_id = so.seller_user_id))) then
    raise exception 'Existing seller orders do not match checkout.';
  end if;
  insert into public.seller_orders (order_id, seller_user_id, seller_business_name,
    product_subtotal, delivery_total, total_amount, holyhub_commission, seller_amount, order_status, fulfilment_status, paid_at,
    dispatch_promise_version, dispatch_min_working_days, dispatch_max_working_days, dispatch_made_to_order, transit_min_working_days, transit_max_working_days, dispatch_promise_captured_at)
  select saved_order_id, s.lister_user_id, s.seller_business_name, grouped.subtotal, s.delivery_total,
    grouped.subtotal + s.delivery_total, round(grouped.subtotal::numeric / 20)::integer,
    grouped.subtotal - round(grouped.subtotal::numeric / 20)::integer, 'paid', 'pending', now(),
    s.dispatch_promise_version, s.dispatch_min_working_days, s.dispatch_max_working_days, s.dispatch_made_to_order, s.transit_min_working_days, s.transit_max_working_days, s.dispatch_promise_captured_at
  from public.checkout_session_sellers s
  join (select lister_user_id, sum(line_total)::integer as subtotal from public.checkout_session_items
    where checkout_session_id = checkout.id group by lister_user_id) grouped on grouped.lister_user_id = s.lister_user_id
  where s.checkout_session_id = checkout.id
  on conflict on constraint seller_orders_order_seller_unique do nothing;

  update public.checkout_sessions set status = 'paid',
    payment_intent_id = coalesce(p_payment_intent_id, payment_intent_id),
    updated_at = now(), completed_at = coalesce(completed_at, now()) where id = checkout.id;
  -- Failure anywhere, including inventory, rolls back every write above.
  perform public.process_paid_checkout_stock(checkout.id);
  return saved_order_id;
end;
$$;

revoke all on function public.process_checkout_payment(text, text, text, integer, text, text, jsonb)
from public, anon, authenticated;
grant execute on function public.process_checkout_payment(text, text, text, integer, text, text, jsonb) to service_role;

commit;
