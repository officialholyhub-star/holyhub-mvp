-- Forward-only payment integrity repair. No historical rows are rewritten.
-- These constraints fail safely if historical duplicates need human review.
alter table public.seller_orders
  add constraint seller_orders_order_seller_unique unique (order_id, seller_user_id);
-- Size snapshots remain stable if a historical variant FK is set to null.
alter table public.order_items
  add constraint order_items_order_product_size_unique
  unique nulls not distinct (order_id, product_id, variant_size);

-- Only signed Stripe events handled by the server may enter this transaction.
create function public.process_checkout_payment(
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
    product_subtotal, delivery_total, total_amount, holyhub_commission, seller_amount, order_status, fulfilment_status, paid_at)
  select saved_order_id, s.lister_user_id, s.seller_business_name, grouped.subtotal, s.delivery_total,
    grouped.subtotal + s.delivery_total, round(grouped.subtotal::numeric / 20)::integer,
    grouped.subtotal - round(grouped.subtotal::numeric / 20)::integer, 'paid', 'pending', now()
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
