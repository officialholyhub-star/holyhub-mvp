-- Full MVP, built from the repository's 001 + 002_business_discovery baseline.
-- Do not apply to an unrelated/partially migrated live schema without reconciliation.
begin;

create table public.platform_settings (
  id boolean primary key default true check(id), commission_bps int not null default 500 check(commission_bps between 0 and 10000),
  free_listing_limit int not null default 10 check(free_listing_limit between 0 and 10000), listing_fee_pence int not null default 20 check(listing_fee_pence between 0 and 100000),
  listing_allowance_mode text check(listing_allowance_mode in ('lifetime','active')),
  new_reserve_bps int check(new_reserve_bps between 0 and 10000), new_reserve_days int check(new_reserve_days between 0 and 365),
  established_reserve_bps int check(established_reserve_bps between 0 and 10000), established_reserve_days int check(established_reserve_days between 0 and 365),
  high_risk_reserve_bps int check(high_risk_reserve_bps between 0 and 10000), high_risk_reserve_days int check(high_risk_reserve_days between 0 and 365),
  appeal_days int check(appeal_days between 1 and 365), appeal_limit int check(appeal_limit between 1 and 10),
  shipping_policy text check(char_length(shipping_policy)<=2000), tax_policy text check(char_length(tax_policy)<=2000),
  updated_at timestamptz not null default now()
);
insert into public.platform_settings(id) values(true);
create table public.audit_log (id uuid primary key default gen_random_uuid(), actor_id uuid, action text not null, entity_id uuid, detail jsonb not null default '{}', created_at timestamptz not null default now());
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, message text not null, href text not null, read_at timestamptz, created_at timestamptz not null default now());

create function public.manages_business(business_id uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from businesses where id=business_id and owner_id=auth.uid() and is_active_account(auth.uid()));
$$;
create function public.public_business(business_id uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from businesses where id=business_id and status='approved' and is_active_account(owner_id));
$$;
revoke all on function public.manages_business(uuid), public.public_business(uuid) from public;
grant execute on function public.manages_business(uuid) to authenticated;
grant execute on function public.public_business(uuid) to anon,authenticated;

create table public.products (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
  name text not null check(char_length(trim(name)) between 2 and 120), description text not null check(char_length(trim(description)) between 20 and 5000),
  category text not null check(category in ('Clothing & Accessories','Beauty & Wellbeing','Books & Stationery','Home & Gifts','Food & Drink','Art & Prints','Digital Products','Other')),
  price_pence int not null check(price_pence between 1 and 100000000), stock int not null default 0 check(stock between 0 and 1000000),
  delivery_info text not null check(char_length(trim(delivery_info)) between 10 and 1500),
  status text not null default 'draft' check(status in ('draft','published','archived')),
  moderation_status text not null default 'visible' check(moderation_status in ('visible','hidden')),
  listing_number int not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(business_id,listing_number)
);
create index products_discovery on public.products(status,category,price_pence);
create table public.product_images (id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id), path text not null unique, created_at timestamptz not null default now());
create table public.listing_fees (product_id uuid primary key references public.products(id), business_id uuid not null references public.businesses(id), amount_pence int not null check(amount_pence>=0), status text not null check(status in ('due','paid','waived')), provider_reference text unique, created_at timestamptz not null default now());
create table public.basket_items (user_id uuid not null references public.profiles(id) on delete cascade, product_id uuid not null references public.products(id), quantity int not null check(quantity between 1 and 99), updated_at timestamptz not null default now(), primary key(user_id,product_id));

create table public.orders (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.profiles(id),
  status text not null default 'draft' check(status in ('draft','awaiting_payment','paid','partially_refunded','refunded','cancelled')),
  subtotal_pence int not null check(subtotal_pence>=0), currency text not null default 'gbp' check(currency='gbp'),
  payment_reference text unique, paid_at timestamptz, created_at timestamptz not null default now()
);
create table public.seller_orders (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id), business_id uuid not null references public.businesses(id),
  gross_pence int not null default 0, commission_pence int not null default 0, reserve_pence int, reserve_release_at timestamptz,
  refunded_pence int not null default 0, transferred_pence int not null default 0,
  fulfillment_status text not null default 'unfulfilled' check(fulfillment_status in ('unfulfilled','processing','dispatched','completed')),
  tracking_note text check(char_length(tracking_note)<=1000), unique(order_id,business_id),
  check(gross_pence>=0 and commission_pence>=0 and commission_pence<=gross_pence and refunded_pence>=0 and refunded_pence<=gross_pence and transferred_pence>=0),
  check(reserve_pence is null or reserve_pence between 0 and gross_pence-commission_pence)
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id), seller_order_id uuid not null references public.seller_orders(id),
  product_id uuid not null references public.products(id), business_id uuid not null references public.businesses(id),
  product_name text not null, quantity int not null check(quantity between 1 and 99), unit_price_pence int not null check(unit_price_pence>0),
  total_pence int not null check(total_pence=quantity*unit_price_pence), commission_pence int not null check(commission_pence between 0 and total_pence)
);
create table public.seller_finances (
  business_id uuid primary key references public.businesses(id), risk_tier text not null default 'new' check(risk_tier in ('new','established','high_risk')),
  reserve_bps int check(reserve_bps between 0 and 10000), reserve_days int check(reserve_days between 0 and 365),
  stripe_account_id text unique, payouts_enabled boolean not null default false
);
create table public.payouts (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), seller_order_id uuid references public.seller_orders(id),
  amount_pence int not null check(amount_pence>0), status text not null default 'pending' check(status in ('pending','paid','failed','reversed')),
  provider_reference text unique, created_at timestamptz not null default now()
);
create table public.payment_events (event_id text primary key, event_type text not null, order_id uuid references public.orders(id), processed_at timestamptz not null default now());

create function public.owns_order(order_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from orders o where o.id=order_id and customer_id=auth.uid() and is_active_account(auth.uid()));
$$;
revoke all on function public.owns_order(uuid) from public;
grant execute on function public.owns_order(uuid) to authenticated;

create table public.refund_cases (
  id uuid primary key default gen_random_uuid(), order_item_id uuid not null unique references public.order_items(id), customer_id uuid not null references public.profiles(id), business_id uuid not null references public.businesses(id),
  reason text not null check(reason in ('not_received','damaged','not_as_described','other')),
  explanation text not null check(char_length(trim(explanation)) between 20 and 5000), requested_pence int not null check(requested_pence>0),
  contacted_seller boolean not null, desired_resolution text not null check(char_length(trim(desired_resolution)) between 5 and 1000),
  seller_response text check(char_length(seller_response) between 20 and 5000),
  status text not null default 'awaiting_seller_response' check(status in ('requested','awaiting_seller_response','under_review','approved','partially_approved','rejected','appealed','closed')),
  approved_pence int not null default 0 check(approved_pence>=0), decision_note text, decided_at timestamptz,
  appeal_deadline timestamptz, appeal_limit int, appeal_count int not null default 0,
  payment_status text not null default 'not_requested' check(payment_status in ('not_requested','pending','paid','failed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.refund_messages (id uuid primary key default gen_random_uuid(), refund_id uuid not null references public.refund_cases(id), author_id uuid not null references public.profiles(id), kind text not null, body text not null, created_at timestamptz not null default now());
create table public.refund_evidence (id uuid primary key default gen_random_uuid(), refund_id uuid not null references public.refund_cases(id), author_id uuid not null references public.profiles(id), path text not null unique, created_at timestamptz not null default now());
create function public.can_access_refund(case_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select is_active_account(auth.uid()) and exists(select 1 from refund_cases r where r.id=case_id and (r.customer_id=auth.uid() or manages_business(r.business_id) or has_role('admin')));
$$;
revoke all on function public.can_access_refund(uuid) from public;
grant execute on function public.can_access_refund(uuid) to authenticated;

-- All money/status writes use validated functions. Clients receive only scoped SELECT access.
do $$ declare tbl text; begin
 foreach tbl in array array['platform_settings','audit_log','notifications','products','product_images','listing_fees','basket_items','orders','seller_orders','order_items','seller_finances','payouts','payment_events','refund_cases','refund_messages','refund_evidence'] loop
   execute format('alter table public.%I enable row level security',tbl);
   execute format('revoke all on public.%I from anon, authenticated',tbl);
   execute format('grant select on public.%I to authenticated',tbl);
 end loop;
end $$;
grant select on public.products,public.product_images,public.platform_settings to anon;
create policy settings_read on public.platform_settings for select to anon,authenticated using(true);
create policy audit_admin on public.audit_log for select to authenticated using(public.has_role('admin'));
create policy notifications_own on public.notifications for select to authenticated using(user_id=auth.uid() and public.is_active_account(auth.uid()));
create policy products_public on public.products for select to anon,authenticated using(status='published' and moderation_status='visible' and public.public_business(business_id));
create policy products_manage on public.products for select to authenticated using(public.manages_business(business_id) or public.has_role('admin'));
create policy product_images_read on public.product_images for select to anon,authenticated using(exists(select 1 from public.products p where p.id=product_id));
create policy listing_fees_own on public.listing_fees for select to authenticated using(public.manages_business(business_id) or public.has_role('admin'));
create policy basket_own on public.basket_items for select to authenticated using(user_id=auth.uid() and public.is_active_account(auth.uid()));
create policy orders_own on public.orders for select to authenticated using(public.owns_order(id) or public.has_role('admin'));
create policy seller_orders_own on public.seller_orders for select to authenticated using(public.manages_business(business_id) or public.owns_order(order_id) or public.has_role('admin'));
create policy order_items_own on public.order_items for select to authenticated using(public.owns_order(order_id) or public.manages_business(business_id) or public.has_role('admin'));
create policy finances_own on public.seller_finances for select to authenticated using(public.manages_business(business_id) or public.has_role('admin'));
create policy payouts_own on public.payouts for select to authenticated using(public.manages_business(business_id) or public.has_role('admin'));
create policy payments_admin on public.payment_events for select to authenticated using(public.has_role('admin'));
create policy refunds_participants on public.refund_cases for select to authenticated using(public.can_access_refund(id));
create policy refund_messages_participants on public.refund_messages for select to authenticated using(public.can_access_refund(refund_id));
create policy refund_evidence_participants on public.refund_evidence for select to authenticated using(public.can_access_refund(refund_id));

create function public.save_product(product_data jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare pid uuid := nullif(product_data->>'id','')::uuid; bid uuid; ordinal int; begin
 select id into bid from businesses where owner_id=auth.uid() and is_active_account(auth.uid()) for update;
 if bid is null then raise exception 'Apply to become a lister first'; end if;
 if pid is null then
   select coalesce(max(listing_number),0)+1 into ordinal from products where business_id=bid;
   insert into products(business_id,name,description,category,price_pence,stock,delivery_info,listing_number)
     values(bid,trim(product_data->>'name'),trim(product_data->>'description'),product_data->>'category',(product_data->>'price_pence')::int,(product_data->>'stock')::int,trim(product_data->>'delivery_info'),ordinal) returning id into pid;
 else
   update products set name=trim(product_data->>'name'),description=trim(product_data->>'description'),category=product_data->>'category',price_pence=(product_data->>'price_pence')::int,stock=(product_data->>'stock')::int,delivery_info=trim(product_data->>'delivery_info'),updated_at=clock_timestamp()
     where id=pid and business_id=bid;
   if not found then raise exception 'Product unavailable'; end if;
 end if;
 insert into audit_log(actor_id,action,entity_id) values(auth.uid(),'product.saved',pid);
 return pid;
end $$;

create function public.set_product_status(product_id uuid, new_status text) returns text language plpgsql security definer set search_path=public as $$
declare p products; s platform_settings; active_count int; begin
 if new_status not in ('draft','published','archived') or new_status is null then raise exception 'Invalid product status'; end if;
 -- Lock the business first: free-slot decisions are serialised across all of its products.
 perform 1 from businesses b where b.owner_id=auth.uid() and is_active_account(auth.uid()) for update;
 select * into p from products where id=product_id and manages_business(business_id) for update;
 if not found then raise exception 'Product unavailable'; end if;
 if new_status='published' then
   if not public_business(p.business_id) then raise exception 'Your lister application must be approved before publishing'; end if;
   if p.moderation_status='hidden' then raise exception 'HolyHub has hidden this product. Contact support'; end if;
   if not exists(select 1 from product_images i where i.product_id=p.id) then raise exception 'Upload at least one product image before publishing'; end if;
   select * into s from platform_settings;
   select count(*) into active_count from products where business_id=p.business_id and status='published' and id<>p.id;
   if (s.listing_allowance_mode='active' and active_count>=s.free_listing_limit) or
      (s.listing_allowance_mode is distinct from 'active' and p.listing_number>s.free_listing_limit) then
     if s.listing_allowance_mode is null then raise exception 'HolyHub must confirm the listing allowance policy before additional listings can publish'; end if;
     if s.listing_fee_pence>0 and not exists(select 1 from listing_fees f where f.product_id=p.id and f.status in ('paid','waived')) then
       insert into listing_fees(product_id,business_id,amount_pence,status) values(p.id,p.business_id,s.listing_fee_pence,'due') on conflict do nothing;
       return 'fee_due';
     end if;
   end if;
 end if;
 update products set status=new_status,updated_at=clock_timestamp() where id=p.id;
 insert into audit_log(actor_id,action,entity_id,detail) values(auth.uid(),'product.status',p.id,jsonb_build_object('status',new_status));
 return new_status;
end $$;

create function public.set_basket_item(product_id uuid, quantity int) returns void language plpgsql security definer set search_path=public as $$
declare p products; begin
 if not is_active_account(auth.uid()) then raise exception 'Sign in to use your basket'; end if;
 if quantity=0 then delete from basket_items b where b.product_id=set_basket_item.product_id and user_id=auth.uid(); return; end if;
 if quantity is null or quantity not between 1 and 99 then raise exception 'Choose a quantity from 1 to 99'; end if;
 select * into p from products where id=product_id and status='published' and moderation_status='visible' and public_business(business_id);
 if not found or p.stock<quantity then raise exception 'This quantity is no longer available'; end if;
  insert into basket_items values(auth.uid(),product_id,quantity,now()) on conflict on constraint basket_items_pkey do update set quantity=excluded.quantity,updated_at=now();
end $$;

create function public.prepare_order() returns uuid language plpgsql security definer set search_path=public as $$
declare o uuid; p record; so uuid; subtotal bigint:=0; fee int; s platform_settings; begin
 if not is_active_account(auth.uid()) then raise exception 'Sign in to review your order'; end if;
 perform 1 from profiles where id=auth.uid() for update;
 if not exists(select 1 from basket_items where user_id=auth.uid()) then raise exception 'Your basket is empty'; end if;
 if (select count(*) from basket_items where user_id=auth.uid())>50 then raise exception 'Use no more than 50 different products in one order'; end if;
 select * into s from platform_settings;
 -- These are unpaid snapshots, not reservations, purchases, or promises of availability.
 delete from order_items where order_id in(select id from orders where customer_id=auth.uid() and status='draft');
 delete from seller_orders where order_id in(select id from orders where customer_id=auth.uid() and status='draft');
 delete from orders where customer_id=auth.uid() and status='draft';
 insert into orders(customer_id,subtotal_pence) values(auth.uid(),0) returning id into o;
 for p in select pr.*,bi.quantity from basket_items bi join products pr on pr.id=bi.product_id where bi.user_id=auth.uid() order by pr.id for share of pr loop
   if p.status<>'published' or p.moderation_status<>'visible' or not public_business(p.business_id) or p.stock<p.quantity then raise exception 'A product in your basket is no longer available. Please review your basket'; end if;
   if manages_business(p.business_id) then raise exception 'You cannot buy from your own storefront'; end if;
   subtotal:=subtotal+p.price_pence::bigint*p.quantity;
   if subtotal>100000000 then raise exception 'This basket exceeds the supported order size'; end if;
   fee:=round(p.price_pence::numeric*p.quantity*s.commission_bps/10000)::int;
   insert into seller_orders(order_id,business_id) values(o,p.business_id) on conflict(order_id,business_id) do update set order_id=excluded.order_id returning id into so;
   insert into order_items(order_id,seller_order_id,product_id,business_id,product_name,quantity,unit_price_pence,total_pence,commission_pence) values(o,so,p.id,p.business_id,p.name,p.quantity,p.price_pence,p.price_pence*p.quantity,fee);
   update seller_orders set gross_pence=gross_pence+p.price_pence*p.quantity,commission_pence=commission_pence+fee where id=so;
 end loop;
 update orders set subtotal_pence=subtotal::int where id=o;
 insert into audit_log(actor_id,action,entity_id) values(auth.uid(),'order.previewed',o);
 return o;
end $$;

create function public.request_refund(item_id uuid, questionnaire jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare i order_items; case_id uuid; seller uuid; begin
 select * into i from order_items where id=item_id and owns_order(order_id);
 if not found then raise exception 'Order item unavailable'; end if;
 if not exists(select 1 from orders where id=i.order_id and status in ('paid','partially_refunded')) then raise exception 'Refund requests are available only for paid orders'; end if;
 if (questionnaire->>'requested_pence')::int not between 1 and i.total_pence then raise exception 'Requested amount must not exceed the item total'; end if;
 insert into refund_cases(order_item_id,customer_id,business_id,reason,explanation,requested_pence,contacted_seller,desired_resolution)
 values(i.id,auth.uid(),i.business_id,questionnaire->>'reason',trim(questionnaire->>'explanation'),(questionnaire->>'requested_pence')::int,(questionnaire->>'contacted_seller')::boolean,trim(questionnaire->>'desired_resolution')) returning id into case_id;
 select owner_id into seller from businesses where id=i.business_id;
 insert into notifications(user_id,message,href) values(seller,'A customer has requested a refund. Please review and respond.','/refunds/'||case_id);
 insert into audit_log(actor_id,action,entity_id) values(auth.uid(),'refund.requested',case_id);
 return case_id;
end $$;

create function public.respond_refund(case_id uuid, response_text text) returns void language plpgsql security definer set search_path=public as $$
declare r refund_cases; begin
 select * into r from refund_cases where id=case_id and manages_business(business_id) for update;
 if not found or r.status not in ('requested','awaiting_seller_response') then raise exception 'This case is not awaiting your response'; end if;
 if char_length(trim(response_text)) not between 20 and 5000 then raise exception 'Write a response of 20–5,000 characters'; end if;
 update refund_cases set seller_response=trim(response_text),status='under_review',updated_at=now() where id=case_id;
 insert into refund_messages(refund_id,author_id,kind,body) values(case_id,auth.uid(),'seller_response',trim(response_text));
 insert into notifications(user_id,message,href) select user_id,'A refund case is ready for review.','/refunds/'||case_id from user_roles where role='admin';
 insert into audit_log(actor_id,action,entity_id) values(auth.uid(),'refund.responded',case_id);
end $$;

create function public.decide_refund(case_id uuid, decision text, amount_pence int, note text) returns void language plpgsql security definer set search_path=public as $$
declare r refund_cases; s platform_settings; max_amount int; begin
 if not has_role('admin') then raise exception 'Not authorised'; end if;
 select * into r from refund_cases where id=case_id for update;
 if not found or r.status not in ('requested','awaiting_seller_response','under_review','appealed') then raise exception 'This case is not ready for a decision'; end if;
 if char_length(trim(note)) not between 20 and 5000 then raise exception 'Explain the decision in 20–5,000 characters'; end if;
 if decision not in ('approved','partially_approved','rejected') or decision is null then raise exception 'Invalid decision'; end if;
 select total_pence into max_amount from order_items where id=r.order_item_id;
 if amount_pence is null or amount_pence not between 0 and least(r.requested_pence,max_amount) or
   (decision='rejected' and amount_pence<>0) or (decision='approved' and amount_pence<>r.requested_pence) or
   (decision='partially_approved' and (amount_pence=0 or amount_pence>=r.requested_pence)) then raise exception 'The amount does not match the decision'; end if;
 select * into s from platform_settings;
 update refund_cases set status=decision,approved_pence=amount_pence,decision_note=trim(note),decided_at=now(),updated_at=now(),
   appeal_limit=coalesce(r.appeal_limit,s.appeal_limit),appeal_deadline=case when s.appeal_days is not null and s.appeal_limit is not null then now()+make_interval(days=>s.appeal_days) end,
   payment_status=case when amount_pence>0 then 'pending' else 'not_requested' end where id=case_id;
 insert into refund_messages(refund_id,author_id,kind,body) values(case_id,auth.uid(),'admin_decision',trim(note));
 insert into notifications(user_id,message,href) select recipient,'HolyHub has reviewed your refund case.','/refunds/'||case_id from (select r.customer_id recipient union select owner_id from businesses where id=r.business_id) recipients;
 insert into audit_log(actor_id,action,entity_id,detail) values(auth.uid(),'refund.decided',case_id,jsonb_build_object('decision',decision,'amount_pence',amount_pence));
end $$;

create function public.appeal_refund(case_id uuid, explanation text) returns void language plpgsql security definer set search_path=public as $$
declare r refund_cases; begin
 select * into r from refund_cases where id=case_id and can_access_refund(id) for update;
 if not found or not (r.customer_id=auth.uid() or manages_business(r.business_id)) then raise exception 'Not authorised'; end if;
 if r.status not in ('approved','partially_approved','rejected') or r.payment_status='paid' or r.appeal_deadline is null or now()>r.appeal_deadline or r.appeal_limit is null or r.appeal_count>=r.appeal_limit then raise exception 'An appeal is not available for this case'; end if;
 if char_length(trim(explanation)) not between 20 and 5000 then raise exception 'Explain your appeal in 20–5,000 characters'; end if;
 update refund_cases set status='appealed',appeal_count=appeal_count+1,updated_at=now() where id=case_id;
 insert into refund_messages(refund_id,author_id,kind,body) values(case_id,auth.uid(),'appeal',trim(explanation));
 insert into notifications(user_id,message,href) select user_id,'A refund decision has been appealed.','/refunds/'||case_id from user_roles where role='admin';
 insert into audit_log(actor_id,action,entity_id) values(auth.uid(),'refund.appealed',case_id);
end $$;

create function public.admin_marketplace(action_name text, target_id uuid, payload jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
 if not has_role('admin') then raise exception 'Not authorised'; end if;
 if action_name='account_status' then
   if target_id=auth.uid() then raise exception 'You cannot change your own account status here'; end if;
   update profiles set account_status=(payload->>'status')::account_status,updated_at=now() where id=target_id;
 elsif action_name='product_moderation' then
   update products set moderation_status=payload->>'status',updated_at=now() where id=target_id;
 elsif action_name='seller_reserve' then
   insert into seller_finances(business_id,risk_tier,reserve_bps,reserve_days) values(target_id,payload->>'risk_tier',nullif(payload->>'reserve_bps','')::int,nullif(payload->>'reserve_days','')::int)
   on conflict(business_id) do update set risk_tier=excluded.risk_tier,reserve_bps=excluded.reserve_bps,reserve_days=excluded.reserve_days;
 elsif action_name='settings' then
   update platform_settings set commission_bps=(payload->>'commission_bps')::int,free_listing_limit=(payload->>'free_listing_limit')::int,listing_fee_pence=(payload->>'listing_fee_pence')::int,
    listing_allowance_mode=nullif(payload->>'listing_allowance_mode',''),
    new_reserve_bps=nullif(payload->>'new_reserve_bps','')::int,new_reserve_days=nullif(payload->>'new_reserve_days','')::int,
    established_reserve_bps=nullif(payload->>'established_reserve_bps','')::int,established_reserve_days=nullif(payload->>'established_reserve_days','')::int,
    high_risk_reserve_bps=nullif(payload->>'high_risk_reserve_bps','')::int,high_risk_reserve_days=nullif(payload->>'high_risk_reserve_days','')::int,
    appeal_days=nullif(payload->>'appeal_days','')::int,appeal_limit=nullif(payload->>'appeal_limit','')::int,
    shipping_policy=nullif(trim(payload->>'shipping_policy'),''),tax_policy=nullif(trim(payload->>'tax_policy'),''),updated_at=now();
 else raise exception 'Unknown admin action'; end if;
 insert into audit_log(actor_id,action,entity_id,detail) values(auth.uid(),'admin.'||action_name,target_id,payload);
end $$;

create function public.update_fulfillment(seller_order_id uuid, new_status text, tracking text) returns void language plpgsql security definer set search_path=public as $$
begin
 if new_status not in ('processing','dispatched','completed') or new_status is null then raise exception 'Invalid fulfillment status'; end if;
 update seller_orders so set fulfillment_status=new_status,tracking_note=nullif(trim(tracking),'') where so.id=seller_order_id and manages_business(so.business_id)
   and exists(select 1 from orders o where o.id=so.order_id and o.status in ('paid','partially_refunded'));
 if not found then raise exception 'Paid seller order unavailable'; end if;
 insert into audit_log(actor_id,action,entity_id,detail) values(auth.uid(),'order.fulfillment',seller_order_id,jsonb_build_object('status',new_status));
end $$;
create function public.mark_notifications_read() returns void language sql security definer set search_path=public as $$ update notifications set read_at=now() where user_id=auth.uid() and is_active_account(auth.uid()) and read_at is null; $$;

-- Revoke default PUBLIC execution, including projects with permissive default function grants.
do $$ declare f record; begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in('save_product','set_product_status','set_basket_item','prepare_order','request_refund','respond_refund','decide_refund','appeal_refund','admin_marketplace','update_fulfillment','mark_notifications_read') loop
  execute format('revoke all on function %s from public, anon',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
commit;
