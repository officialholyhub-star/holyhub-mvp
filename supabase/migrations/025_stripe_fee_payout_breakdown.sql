alter table public.orders
  add column if not exists stripe_processing_fee integer check (stripe_processing_fee is null or stripe_processing_fee >= 0),
  add column if not exists seller_payout_total integer check (seller_payout_total is null or seller_payout_total >= 0);

alter table public.seller_orders
  add column if not exists stripe_processing_fee integer check (stripe_processing_fee is null or stripe_processing_fee >= 0),
  add column if not exists seller_payout_amount integer check (seller_payout_amount is null or seller_payout_amount >= 0);

create or replace function public.record_order_stripe_fee(
  p_stripe_session_id text,
  p_stripe_processing_fee integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_order public.orders;
  seller_gross_total bigint;
  allocated_total bigint;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Service access is required.' using errcode = '42501';
  end if;

  if p_stripe_session_id is null or length(p_stripe_session_id) not between 1 and 255
    or p_stripe_processing_fee is null or p_stripe_processing_fee < 0 then
    raise exception 'Invalid Stripe fee details.';
  end if;

  select * into saved_order
  from public.orders
  where stripe_checkout_session_id = p_stripe_session_id
  for update;

  if not found then
    raise exception 'Paid order not found.';
  end if;

  if saved_order.order_status <> 'paid' then
    raise exception 'Stripe fee can only be recorded for a paid order.';
  end if;

  if saved_order.stripe_processing_fee is not null
    and saved_order.stripe_processing_fee <> p_stripe_processing_fee then
    raise exception 'Stored Stripe fee does not match.';
  end if;

  if p_stripe_processing_fee > saved_order.seller_amount_total + saved_order.delivery_total then
    raise exception 'Stripe fee exceeds seller proceeds.';
  end if;

  select coalesce(sum(total_amount), 0)
  into seller_gross_total
  from public.seller_orders
  where order_id = saved_order.id;

  if seller_gross_total <> saved_order.total_amount then
    raise exception 'Seller order totals do not match the paid order.';
  end if;

  if saved_order.total_amount = 0 then
    if p_stripe_processing_fee <> 0 then
      raise exception 'A zero-value order cannot have a Stripe fee.';
    end if;

    update public.seller_orders
    set stripe_processing_fee = 0,
        seller_payout_amount = seller_amount + delivery_total,
        updated_at = now()
    where order_id = saved_order.id;
  else
    with weighted as (
      select
        so.id,
        floor((p_stripe_processing_fee::numeric * so.total_amount::numeric) / saved_order.total_amount::numeric)::integer as base_fee,
        ((p_stripe_processing_fee::numeric * so.total_amount::numeric) / saved_order.total_amount::numeric)
          - floor((p_stripe_processing_fee::numeric * so.total_amount::numeric) / saved_order.total_amount::numeric) as fractional_fee
      from public.seller_orders so
      where so.order_id = saved_order.id
    ), ranked as (
      select
        id,
        base_fee,
        fractional_fee,
        row_number() over (order by fractional_fee desc, id) as fee_rank,
        sum(base_fee) over ()::integer as base_total
      from weighted
    ), allocations as (
      select
        id,
        base_fee + case when fee_rank <= (p_stripe_processing_fee - base_total) then 1 else 0 end as allocated_fee
      from ranked
    )
    update public.seller_orders so
    set stripe_processing_fee = allocations.allocated_fee,
        seller_payout_amount = so.seller_amount + so.delivery_total - allocations.allocated_fee,
        updated_at = now()
    from allocations
    where so.id = allocations.id;
  end if;

  select coalesce(sum(stripe_processing_fee), 0)
  into allocated_total
  from public.seller_orders
  where order_id = saved_order.id;

  if allocated_total <> p_stripe_processing_fee then
    raise exception 'Stripe fee allocation is inconsistent.';
  end if;

  update public.orders
  set stripe_processing_fee = p_stripe_processing_fee,
      seller_payout_total = seller_amount_total + delivery_total - p_stripe_processing_fee,
      updated_at = now()
  where id = saved_order.id;

  return saved_order.id;
end;
$$;

revoke all on function public.record_order_stripe_fee(text, integer) from public;
grant execute on function public.record_order_stripe_fee(text, integer) to service_role;
