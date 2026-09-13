-- Stage 4 TEST-mode checkout only. No Connect, transfers, payouts, tax or shipping rates.
begin;

alter table public.orders
  add column checkout_session_id text unique,
  add column checkout_state text not null default 'none' check(checkout_state in ('none','creating','open','completed','cancelled','expired','failed')),
  add column checkout_expires_at timestamptz;

create table public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity int not null check(quantity between 1 and 99),
  status text not null default 'active' check(status in ('active','completed','released')),
  expires_at timestamptz not null,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  unique(order_id, product_id)
);
create index stock_reservations_product_active on public.stock_reservations(product_id, status, expires_at);
create index stock_reservations_order on public.stock_reservations(order_id, status);
alter table public.stock_reservations enable row level security;
revoke all on public.stock_reservations from anon, authenticated;
grant select on public.stock_reservations to authenticated;

create or replace function public.release_expired_checkout_reservations()
returns void language plpgsql security definer set search_path=public as $$
begin
  update stock_reservations
     set status='released', released_at=clock_timestamp()
   where status='active' and expires_at<=clock_timestamp();

  update orders
     set status='cancelled', checkout_state='expired'
   where status='awaiting_payment'
     and checkout_expires_at is not null
     and checkout_expires_at<=clock_timestamp();
end;
$$;
revoke all on function public.release_expired_checkout_reservations() from public, anon, authenticated;
grant execute on function public.release_expired_checkout_reservations() to authenticated, service_role;

create or replace function public.begin_checkout(order_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  o orders;
  p products;
  i record;
  reserved bigint;
  expires timestamptz := clock_timestamp()+interval '30 minutes';
begin
  if not is_active_account(auth.uid()) then raise exception 'Sign in to continue to checkout'; end if;
  perform release_expired_checkout_reservations();
  select * into o from orders where id=begin_checkout.order_id and customer_id=auth.uid() for update;
  if not found then raise exception 'Order unavailable'; end if;
  if o.status in ('paid','partially_refunded','refunded') then raise exception 'This order has already been paid'; end if;

  if o.status='awaiting_payment' then
    if o.checkout_session_id is not null and o.checkout_expires_at>clock_timestamp() then
      return jsonb_build_object('order_id',o.id,'existing',true,'checkout_session_id',o.checkout_session_id);
    end if;
    raise exception 'This checkout is already being prepared. Please try again shortly';
  end if;
  if o.status not in ('draft','cancelled') then raise exception 'This order is not available for checkout'; end if;
  if not exists(select 1 from order_items oi where oi.order_id=o.id) then raise exception 'This order has no items'; end if;

  for i in select oi.product_id,oi.quantity from order_items oi where oi.order_id=o.id order by oi.product_id loop
    select * into p from products where id=i.product_id for update;
    if not found then raise exception 'A product in this order is unavailable'; end if;
    select coalesce(sum(sr.quantity),0) into reserved
      from stock_reservations sr
     where sr.product_id=i.product_id and sr.order_id<>o.id and sr.status='active' and sr.expires_at>clock_timestamp();
    if p.status<>'published' or p.moderation_status<>'visible' or not public_business(p.business_id) or p.stock-reserved<i.quantity then
      raise exception 'A product in this order no longer has enough stock';
    end if;
    insert into stock_reservations(order_id,product_id,quantity,status,expires_at,released_at)
      values(o.id,i.product_id,i.quantity,'active',expires,null)
      on conflict on constraint stock_reservations_order_id_product_id_key do update set quantity=excluded.quantity,status='active',expires_at=excluded.expires_at,released_at=null;
  end loop;

  update orders
     set status='awaiting_payment', checkout_state='creating', checkout_session_id=null,
         payment_reference=null, checkout_expires_at=expires
   where id=o.id;

  return jsonb_build_object(
    'order_id',o.id,
    'existing',false,
    'expires_at',expires,
    'items',(select jsonb_agg(jsonb_build_object('product_name',oi.product_name,'quantity',oi.quantity,'unit_price_pence',oi.unit_price_pence) order by oi.id) from order_items oi where oi.order_id=o.id),
    'subtotal_pence',o.subtotal_pence,
    'currency',o.currency
  );
end;
$$;
revoke all on function public.begin_checkout(uuid) from public, anon;
grant execute on function public.begin_checkout(uuid) to authenticated;

create or replace function public.attach_checkout_session(order_id uuid, session_id text)
returns boolean language plpgsql security definer set search_path=public as $$
declare o orders;
begin
  if not is_active_account(auth.uid()) then raise exception 'Sign in to continue to checkout'; end if;
  if session_id !~ '^cs_' then raise exception 'Invalid checkout session'; end if;
  select * into o from orders where id=attach_checkout_session.order_id and customer_id=auth.uid() for update;
  if not found or o.status<>'awaiting_payment' or o.checkout_state<>'creating' then raise exception 'Checkout is no longer available'; end if;
  update orders set payment_reference=session_id,checkout_session_id=session_id,checkout_state='open' where id=o.id;
  return true;
end;
$$;
revoke all on function public.attach_checkout_session(uuid,text) from public, anon;
grant execute on function public.attach_checkout_session(uuid,text) to authenticated;

create or replace function public.release_checkout(order_id uuid, release_state text default 'cancelled')
returns boolean language plpgsql security definer set search_path=public as $$
declare o orders;
begin
  if not is_active_account(auth.uid()) then raise exception 'Sign in to continue'; end if;
  if release_state not in ('cancelled','failed','expired') then raise exception 'Invalid checkout release state'; end if;
  select * into o from orders where id=release_checkout.order_id and customer_id=auth.uid() for update;
  if not found then raise exception 'Order unavailable'; end if;
  if o.status='paid' then return false; end if;
  update stock_reservations set status='released',released_at=clock_timestamp() where stock_reservations.order_id=o.id and status='active';
  update orders set status='cancelled',checkout_state=release_state,checkout_expires_at=clock_timestamp() where id=o.id and status='awaiting_payment';
  return true;
end;
$$;
revoke all on function public.release_checkout(uuid,text) from public, anon;
grant execute on function public.release_checkout(uuid,text) to authenticated;

create or replace function public.record_checkout_failure(stripe_event_id text, stripe_event_type text, checkout_session_id text)
returns boolean language plpgsql security definer set search_path=public as $$
declare o orders;
begin
  if stripe_event_id !~ '^evt_' or checkout_session_id !~ '^cs_' or stripe_event_type not in ('checkout.session.async_payment_failed','checkout.session.expired') then raise exception 'Invalid payment event'; end if;
  if exists(select 1 from payment_events where event_id=stripe_event_id) then return false; end if;
  select * into o from orders where orders.payment_reference=record_checkout_failure.checkout_session_id for update;
  if not found then return false; end if;
  insert into payment_events(event_id,event_type,order_id) values(stripe_event_id,stripe_event_type,o.id);
  if o.status='paid' then return false; end if;
  update stock_reservations set status='released',released_at=clock_timestamp() where order_id=o.id and status='active';
  update orders set status='cancelled',checkout_state=case when stripe_event_type='checkout.session.expired' then 'expired' else 'failed' end,checkout_expires_at=clock_timestamp() where id=o.id and status='awaiting_payment';
  return true;
end;
$$;
revoke all on function public.record_checkout_failure(text,text,text) from public, anon, authenticated;
grant execute on function public.record_checkout_failure(text,text,text) to service_role;

create or replace function public.record_verified_checkout(stripe_event_id text, stripe_event_type text, checkout_session_id text, holyhub_order_id uuid, paid_amount int, paid_currency text)
returns boolean language plpgsql security definer set search_path=public as $$
declare
  o orders;
  r record;
begin
  if stripe_event_id !~ '^evt_' or checkout_session_id !~ '^cs_' or stripe_event_type not in ('checkout.session.completed','checkout.session.async_payment_succeeded') then raise exception 'Invalid payment event'; end if;
  if exists(select 1 from payment_events where event_id=stripe_event_id) then return false; end if;
  select * into o from orders where id=holyhub_order_id for update;
  if not found or o.payment_reference<>checkout_session_id or o.checkout_session_id<>checkout_session_id or o.subtotal_pence<>paid_amount or o.currency<>paid_currency or paid_amount<=0 then raise exception 'Payment does not match the server order'; end if;
  if o.status='paid' then return false; end if;
  if o.status<>'awaiting_payment' then raise exception 'Order is not awaiting verified payment'; end if;
  if not exists(select 1 from stock_reservations sr where sr.order_id=o.id and sr.status='active') then raise exception 'This order has no active stock reservation'; end if;
  insert into payment_events(event_id,event_type,order_id) values(stripe_event_id,stripe_event_type,o.id);
  for r in select * from stock_reservations where order_id=o.id and status='active' for update loop
    update products set stock=stock-r.quantity,updated_at=clock_timestamp() where id=r.product_id and stock>=r.quantity;
    if not found then raise exception 'Stock changed before payment confirmation'; end if;
    update stock_reservations set status='completed' where id=r.id;
    delete from basket_items where user_id=o.customer_id and product_id=r.product_id;
  end loop;
  update orders set status='paid',checkout_state='completed',paid_at=clock_timestamp() where id=o.id;
  update seller_orders set payment_status='paid',reserve_pence=round((gross_pence-commission_pence)::numeric*reserve_bps/10000)::int,reserve_release_at=clock_timestamp()+make_interval(days=>reserve_days) where seller_orders.order_id=o.id;
  insert into notifications(user_id,message,href) values(o.customer_id,'Your payment has been verified.','/orders/'||o.id);
  insert into notifications(user_id,message,href) select b.owner_id,'A paid order is ready to review.','/seller/orders' from seller_orders so join businesses b on b.id=so.business_id where so.order_id=o.id;
  insert into audit_log(action,entity_id,detail) values('payment.verified',o.id,jsonb_build_object('event_id',stripe_event_id,'amount_pence',paid_amount));
  return true;
end;
$$;
revoke all on function public.record_verified_checkout(text,text,text,uuid,int,text) from public, anon, authenticated;
grant execute on function public.record_verified_checkout(text,text,text,uuid,int,text) to service_role;

commit;
