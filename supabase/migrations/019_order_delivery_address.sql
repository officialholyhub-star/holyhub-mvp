-- Snapshot the customer delivery address on the paid order for fulfilment.
alter table public.orders
  add column delivery_recipient_name text,
  add column delivery_address_line1 text,
  add column delivery_address_line2 text,
  add column delivery_city text,
  add column delivery_postcode text,
  add column delivery_country text;

grant insert (
  delivery_recipient_name,
  delivery_address_line1,
  delivery_address_line2,
  delivery_city,
  delivery_postcode,
  delivery_country
) on public.orders to service_role;

-- Break the orders -> seller_orders -> orders SELECT-policy cycle while keeping
-- the same ownership rules. This private helper reveals only whether the caller
-- owns a seller order; it never returns order data or accepts a caller identity.
create function private.is_order_seller(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.seller_orders
    where order_id = p_order_id and seller_user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_order_seller(uuid) from public, anon;
grant execute on function private.is_order_seller(uuid) to authenticated;

drop policy "orders_select_own_or_seller_or_admin" on public.orders;
create policy "orders_select_own_or_seller_or_admin"
on public.orders for select to authenticated
using (
  user_id = (select auth.uid())
  or private.is_order_seller(id)
  or (select private.has_role('admin'))
);

-- Service-role bypass of RLS does not provide SQL privileges. Paid-order
-- idempotency checks and fulfilment customer-name lookups need these reads.
grant select on public.orders to service_role;
grant select (id, full_name) on public.profiles to service_role;
