-- Carrier-neutral seller fulfilment metadata and lister update access.
alter table public.seller_orders
  add column carrier text check (carrier is null or carrier in ('Royal Mail', 'Evri', 'DPD', 'DHL', 'Yodel', 'Other')),
  add column carrier_other text check (carrier_other is null or char_length(carrier_other) between 1 and 100),
  add column tracking_number text check (tracking_number is null or char_length(tracking_number) between 1 and 150),
  add column tracking_url text check (tracking_url is null or char_length(tracking_url) between 1 and 500),
  add column fulfilment_note text check (fulfilment_note is null or char_length(fulfilment_note) between 1 and 1000);

alter table public.seller_orders
  add constraint seller_orders_other_carrier_check
  check ((carrier = 'Other' and carrier_other is not null) or carrier <> 'Other' or carrier is null);

create policy "seller_orders_update_own_fulfilment"
on public.seller_orders
for update
to authenticated
using (seller_user_id = (select auth.uid()))
with check (seller_user_id = (select auth.uid()));

grant update (fulfilment_status, carrier, carrier_other, tracking_number, tracking_url, dispatched_at, delivered_at, fulfilment_note, updated_at)
on public.seller_orders to authenticated;
