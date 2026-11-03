-- Customers need delivery progress, not a seller's private reserve/earnings columns.
begin;
create function public.order_delivery(order_id uuid)
returns table(seller_order_id uuid,business_id uuid,fulfillment_status text,tracking_note text)
language plpgsql stable security definer set search_path=public as $$
begin
 if not (owns_order(order_id) or has_role('admin')) then raise exception 'Order unavailable';end if;
 return query select so.id,so.business_id,so.fulfillment_status,so.tracking_note from seller_orders so where so.order_id=order_delivery.order_id;
end $$;
revoke all on function public.order_delivery(uuid) from public,anon;
grant execute on function public.order_delivery(uuid) to authenticated;
commit;
