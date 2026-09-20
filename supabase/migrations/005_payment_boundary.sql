-- Payment ingestion only. Checkout-session creation, shipping/tax, stock reservation,
-- transfers and real refund execution remain disabled until their integration is completed.
begin;
alter table public.seller_orders add column payment_status text not null default 'unpaid' check(payment_status in ('unpaid','paid','partially_refunded','refunded'));
alter table public.seller_orders add column reserve_bps int check(reserve_bps between 0 and 10000);
alter table public.seller_orders add column reserve_days int check(reserve_days between 0 and 365);
drop policy seller_orders_own on public.seller_orders;
create policy seller_orders_own on public.seller_orders for select to authenticated using(public.manages_business(business_id) or public.has_role('admin'));

create function public.snapshot_seller_reserve() returns trigger language plpgsql security definer set search_path=public as $$
declare s platform_settings; f seller_finances; tier text; begin
 select * into s from platform_settings;select * into f from seller_finances where business_id=new.business_id;tier:=coalesce(f.risk_tier,'new');
 new.reserve_bps:=coalesce(f.reserve_bps,case tier when 'established' then s.established_reserve_bps when 'high_risk' then s.high_risk_reserve_bps else s.new_reserve_bps end);
 new.reserve_days:=coalesce(f.reserve_days,case tier when 'established' then s.established_reserve_days when 'high_risk' then s.high_risk_reserve_days else s.new_reserve_days end);
 return new;
end $$;
create trigger snapshot_reserve before insert on public.seller_orders for each row execute function public.snapshot_seller_reserve();
revoke all on function public.snapshot_seller_reserve() from public,anon,authenticated;

create function public.record_verified_checkout(stripe_event_id text, stripe_event_type text, checkout_session_id text, holyhub_order_id uuid, paid_amount int, paid_currency text)
returns boolean language plpgsql security definer set search_path=public as $$
declare o orders; begin
 if stripe_event_id !~ '^evt_' or checkout_session_id !~ '^cs_' or stripe_event_type not in ('checkout.session.completed','checkout.session.async_payment_succeeded') then raise exception 'Invalid payment event';end if;
 select * into o from orders where id=holyhub_order_id for update;
 if not found or o.payment_reference is null or o.payment_reference<>checkout_session_id or o.subtotal_pence<>paid_amount or o.currency<>paid_currency or paid_amount<=0 then raise exception 'Payment does not match the server order';end if;
 if exists(select 1 from payment_events where event_id=stripe_event_id) then return false;end if;
 if o.status not in ('awaiting_payment','paid','partially_refunded','refunded') then raise exception 'Order is not awaiting verified payment';end if;
 if o.status='awaiting_payment' and exists(select 1 from seller_orders where order_id=o.id and (reserve_bps is null or reserve_days is null)) then raise exception 'Seller reserve policy was not confirmed before checkout';end if;
 insert into payment_events(event_id,event_type,order_id) values(stripe_event_id,stripe_event_type,o.id);
 if o.status<>'awaiting_payment' then return false;end if;
 update orders set status='paid',paid_at=now() where id=o.id;
 update seller_orders set payment_status='paid',reserve_pence=round((gross_pence-commission_pence)::numeric*reserve_bps/10000)::int,reserve_release_at=now()+make_interval(days=>reserve_days) where order_id=o.id;
 insert into notifications(user_id,message,href) values(o.customer_id,'Your payment has been verified.','/orders/'||o.id);
 insert into notifications(user_id,message,href) select b.owner_id,'A paid order is ready to review.','/seller/orders' from seller_orders so join businesses b on b.id=so.business_id where so.order_id=o.id;
 insert into audit_log(action,entity_id,detail) values('payment.verified',o.id,jsonb_build_object('event_id',stripe_event_id,'amount_pence',paid_amount));
 return true;
end $$;
revoke all on function public.record_verified_checkout(text,text,text,uuid,int,text) from public,anon,authenticated;
grant execute on function public.record_verified_checkout(text,text,text,uuid,int,text) to service_role;

create function public.business_review_notification() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status is distinct from old.status then
  insert into notifications(user_id,message,href) values(new.owner_id,'Your HolyHub lister review status is now '||new.status||'.','/account/business');
  insert into audit_log(actor_id,action,entity_id,detail) values(auth.uid(),'business.review',new.id,jsonb_build_object('from',old.status,'to',new.status));
 end if;return new;
end $$;
create trigger business_review_update after update on public.businesses for each row execute function public.business_review_notification();
revoke all on function public.business_review_notification() from public,anon,authenticated;
commit;
