-- ONE-TIME TEST ONLY recovery for a partial 009_stage4_test_checkout.sql run.
-- Run only in the brand-new TEST project after migrations 001-008.
begin;

-- These functions are created only by 009 and may be absent if the failure was earlier.
do $$
begin
  if to_regprocedure('public.release_expired_checkout_reservations()') is not null then
    drop function public.release_expired_checkout_reservations();
  end if;
  if to_regprocedure('public.begin_checkout(uuid)') is not null then
    drop function public.begin_checkout(uuid);
  end if;
  if to_regprocedure('public.attach_checkout_session(uuid,text)') is not null then
    drop function public.attach_checkout_session(uuid,text);
  end if;
  if to_regprocedure('public.release_checkout(uuid,text)') is not null then
    drop function public.release_checkout(uuid,text);
  end if;
  if to_regprocedure('public.record_checkout_failure(text,text,text)') is not null then
    drop function public.record_checkout_failure(text,text,text);
  end if;
end;
$$;

-- 009 replaced this migration-005 function; restore the migration-005 definition.
create or replace function public.record_verified_checkout(stripe_event_id text, stripe_event_type text, checkout_session_id text, holyhub_order_id uuid, paid_amount int, paid_currency text)
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

-- 009 owns this table, its indexes, constraints, RLS state and grants.
drop table public.stock_reservations;

-- Dropping these columns also removes their 009-owned unique/check constraints.
alter table public.orders
  drop column checkout_session_id,
  drop column checkout_state,
  drop column checkout_expires_at;

commit;
