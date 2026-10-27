-- C11: forward-only, separate platform charges and seller transfers.
-- No historical migration is changed, no terms activated, no acceptance invented.
create table public.payment_policy (
  id boolean primary key default true check (id),
  commission_basis_points integer not null default 500 check (commission_basis_points = 500),
  release_policy text not null default 'seller_delivered' check (release_policy = 'seller_delivered'),
  recovery_terms_version text references public.lister_terms_versions(version) on delete restrict
);
insert into public.payment_policy(id) values(true);

create table public.seller_payment_accounts (
  seller_user_id uuid primary key references public.profiles(id) on delete restrict,
  stripe_account_id text not null unique check (stripe_account_id ~ '^acct_'),
  verified_at timestamptz not null default now(),
  verified_by uuid not null references public.profiles(id) on delete restrict
);
create table public.platform_payments (
  order_id uuid primary key references public.orders(id) on delete restrict,
  stripe_session_id text not null unique,
  payment_intent_id text unique,
  charge_id text unique,
  amount integer not null check(amount >= 0),
  currency text not null default 'gbp' check(currency = 'gbp'),
  reconciliation_status text not null default 'needs_charge' check(reconciliation_status in ('needs_charge','matched','attention')),
  updated_at timestamptz not null default now()
);
create table public.seller_allocations (
  id uuid primary key default gen_random_uuid(),
  seller_order_id uuid not null unique references public.seller_orders(id) on delete restrict,
  order_id uuid not null references public.platform_payments(order_id) on delete restrict,
  seller_user_id uuid not null references public.profiles(id) on delete restrict,
  product_value integer not null check(product_value >= 0),
  delivery_value integer not null check(delivery_value >= 0),
  commission integer not null check(commission >= 0 and commission <= product_value),
  processing_fee integer check(processing_fee >= 0),
  refunded_product integer not null default 0 check(refunded_product between 0 and product_value),
  refunded_delivery integer not null default 0 check(refunded_delivery between 0 and delivery_value),
  commission_credit integer not null default 0 check(commission_credit between 0 and commission),
  seller_refund_reserved integer not null default 0 check(seller_refund_reserved >= 0),
  created_at timestamptz not null default now()
);
create index seller_allocations_seller_idx on public.seller_allocations(seller_user_id,id);
create table public.payment_operations (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.seller_allocations(id) on delete restrict,
  kind text not null check(kind in ('transfer','refund','reversal')),
  request_key text not null unique check(length(request_key) between 1 and 200),
  amount integer not null check(amount >= 0),
  details jsonb not null default '{}',
  status text not null default 'queued' check(status in ('queued','running','pending','succeeded','failed','attention')),
  stripe_id text unique,
  first_attempt_at timestamptz,
  lease_until timestamptz,
  lease_token uuid,
  failure_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index payment_one_transfer_idx on public.payment_operations(allocation_id) where kind='transfer';
create unique index payment_one_reversal_idx on public.payment_operations((details->>'refund_operation_id')) where kind='reversal';
create index payment_operations_queue_idx on public.payment_operations(status,created_at);
create table public.refund_lines (
  operation_id uuid not null references public.payment_operations(id) on delete restrict,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  product_amount integer not null check(product_amount >= 0),
  restore_quantity integer not null default 0 check(restore_quantity >= 0),
  restored_at timestamptz,
  primary key(operation_id,order_item_id)
);
create index refund_lines_item_idx on public.refund_lines(order_item_id);
create table public.seller_debts (
  id uuid primary key default gen_random_uuid(),
  seller_user_id uuid not null references public.profiles(id) on delete restrict,
  allocation_id uuid not null references public.seller_allocations(id) on delete restrict,
  refund_operation_id uuid not null unique references public.payment_operations(id) on delete restrict,
  original_amount integer not null check(original_amount > 0),
  recovered_amount integer not null default 0 check(recovered_amount between 0 and original_amount),
  reason text not null,
  recovery_status text not null default 'pending_reversal' check(recovery_status in ('pending_reversal','outstanding','resolved')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index seller_debts_outstanding_idx on public.seller_debts(seller_user_id,created_at) where recovery_status <> 'resolved';
create table public.seller_recovery_events (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.seller_debts(id) on delete restrict,
  operation_id uuid not null references public.payment_operations(id) on delete restrict,
  amount integer not null check(amount > 0),
  method text not null check(method in ('transfer_reversal','future_proceeds')),
  status text not null check(status in ('reserved','applied','released')),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  release_reason text,
  unique(debt_id,operation_id)
);
create table public.payment_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  stripe_object_id text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  state text not null default 'pending' check(state in ('pending','processed','attention'))
);

-- All new financial data is server-only. No public/customer writes.
do $$ declare t text; begin
  foreach t in array array['payment_policy','seller_payment_accounts','platform_payments','seller_allocations',
    'payment_operations','refund_lines','seller_debts','seller_recovery_events','payment_webhook_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update on public.%I to service_role',t);
  end loop;
end $$;

grant select on public.seller_orders to service_role;

-- Serialize all financial mutations for one seller, including across orders.
create function private.payment_seller_lock(p_seller uuid) returns void language sql set search_path='' as $$
  select pg_advisory_xact_lock(hashtextextended(p_seller::text, 1108));
$$;
revoke all on function private.payment_seller_lock(uuid) from public;
grant usage on schema private to service_role;
grant execute on function private.payment_seller_lock(uuid) to service_role;

create function public.sync_payment_order(p_order_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare o public.orders; c public.checkout_sessions;
begin
  select * into strict o from public.orders where id=p_order_id;
  if o.order_status <> 'paid' then raise exception 'A paid order is required.'; end if;
  select * into strict c from public.checkout_sessions where id=o.checkout_session_id;
  insert into public.platform_payments(order_id,stripe_session_id,payment_intent_id,amount)
    values(o.id,o.stripe_checkout_session_id,c.payment_intent_id,o.total_amount)
    on conflict(order_id) do update set payment_intent_id=coalesce(public.platform_payments.payment_intent_id,excluded.payment_intent_id);
  insert into public.seller_allocations(seller_order_id,order_id,seller_user_id,product_value,delivery_value,commission,processing_fee)
    select id,order_id,seller_user_id,product_subtotal,delivery_total,holyhub_commission,stripe_processing_fee
    from public.seller_orders where order_id=o.id on conflict(seller_order_id) do nothing;
end $$;
revoke all on function public.sync_payment_order(uuid) from public;
grant execute on function public.sync_payment_order(uuid) to service_role;

-- Charge identity and actual fee must be independently verified with Stripe by
-- the server. Transfers remain blocked until this evidence is recorded.
create function public.match_payment_charge(p_order_id uuid,p_intent text,p_charge text,p_amount integer,p_fee integer)
returns void language plpgsql security invoker set search_path='' as $$
declare p public.platform_payments;
begin
  perform public.sync_payment_order(p_order_id);
  select * into strict p from public.platform_payments where order_id=p_order_id for update;
  if p.payment_intent_id is distinct from p_intent or p.amount<>p_amount or p_charge !~ '^ch_' or p_fee<0
    or (p.charge_id is not null and p.charge_id<>p_charge) then raise exception 'Charge evidence mismatch.'; end if;
  perform public.record_order_stripe_fee(p.stripe_session_id,p_fee);
  update public.seller_allocations a set processing_fee=so.stripe_processing_fee
    from public.seller_orders so where a.seller_order_id=so.id and a.order_id=p_order_id;
  update public.platform_payments set charge_id=p_charge,reconciliation_status=case
    when (select sum(commission) from public.seller_allocations where order_id=p_order_id)
      = (select holyhub_commission from public.orders where id=p_order_id) then 'matched' else 'attention' end,
    updated_at=now() where order_id=p_order_id;
end $$;
revoke all on function public.match_payment_charge(uuid,text,text,integer,integer) from public;
grant execute on function public.match_payment_charge(uuid,text,text,integer,integer) to service_role;

-- A refund request reserves only this seller's allocation. Items and stock
-- decisions are explicit; faulty returns use restore_quantity=0.
create function public.request_payment_refund(p_seller_order_id uuid,p_key text,p_lines jsonb,p_delivery integer,
  p_reason text,p_seller_responsible boolean default true)
returns uuid language plpgsql security invoker set search_path='' as $$
declare a public.seller_allocations; so public.seller_orders; op public.payment_operations; t public.payment_operations;
  line jsonb; item public.order_items; product_amount integer:=0; credit integer; responsibility integer;
  held integer; net integer; previous_amount bigint; previous_stock bigint; op_id uuid:=gen_random_uuid();
begin
  select * into strict so from public.seller_orders where id=p_seller_order_id;
  perform private.payment_seller_lock(so.seller_user_id);
  perform public.sync_payment_order(so.order_id);
  select * into strict a from public.seller_allocations where seller_order_id=so.id for update;
  select * into op from public.payment_operations where request_key=p_key;
  if found then
    if op.allocation_id<>a.id or op.details->'request_lines' is distinct from p_lines
      or (op.details->>'delivery')::integer is distinct from p_delivery
      or op.details->>'reason' is distinct from p_reason
      or (op.details->>'seller_responsible')::boolean is distinct from p_seller_responsible then
      raise exception 'Refund idempotency key conflict.'; end if;
    return op.id;
  end if;
  if p_delivery is null or p_delivery<0 or a.refunded_delivery+p_delivery>a.delivery_value
    or p_reason is null or length(btrim(p_reason)) not between 1 and 1000
    or p_seller_responsible is null or jsonb_typeof(p_lines) is distinct from 'array'
    or jsonb_array_length(p_lines)>100 then raise exception 'Invalid refund request.'; end if;
  if exists(select 1 from jsonb_array_elements(p_lines) x group by x->>'item_id' having count(*)>1) then
    raise exception 'Duplicate refund item.'; end if;
  for line in select * from jsonb_array_elements(p_lines) loop
    select * into strict item from public.order_items where id=(line->>'item_id')::uuid
      and order_id=so.order_id and seller_user_id=so.seller_user_id;
    select coalesce(sum(l.product_amount),0),coalesce(sum(l.restore_quantity),0)
      into previous_amount,previous_stock from public.refund_lines l
      join public.payment_operations o on o.id=l.operation_id where l.order_item_id=item.id and o.status<>'failed';
    if (line->>'amount')::integer is null or (line->>'amount')::integer<0
      or ((line->>'amount')::integer=0 and item.line_total<>0)
      or previous_amount+(line->>'amount')::integer>item.line_total
      or (line->>'restore_quantity')::integer is null or (line->>'restore_quantity')::integer<0
      or previous_stock+(line->>'restore_quantity')::integer>item.quantity
      or (line->>'restore_quantity')::bigint*item.unit_amount>(line->>'amount')::integer then
      raise exception 'Refund exceeds item value or restorable quantity.'; end if;
    if (line->>'restore_quantity')::integer>0 and not exists(
      select 1 from public.checkout_session_items ci join public.orders o on o.checkout_session_id=ci.checkout_session_id
      where o.id=so.order_id and ci.product_id=item.product_id and ci.variant_id is not distinct from item.variant_id
        and ci.lister_user_id=so.seller_user_id and ci.stock_decremented
    ) then raise exception 'Original stock decrement must be verified before restoration.'; end if;
    product_amount:=product_amount+(line->>'amount')::integer;
  end loop;
  if (product_amount+p_delivery=0 and not exists(select 1 from jsonb_array_elements(p_lines) x where (x->>'restore_quantity')::integer>0))
    or a.refunded_product+product_amount>a.product_value then
    raise exception 'Refund exceeds seller allocation.'; end if;
  -- Cumulative rounding ensures split refunds credit exactly the original fee.
  credit:=least(a.commission,round((a.refunded_product+product_amount)::numeric/20)::integer)-a.commission_credit;
  responsibility:=case when p_seller_responsible then product_amount-credit+p_delivery else 0 end;
  -- Refunds need not wait for fee availability. Conservatively reserve the
  -- full seller share; fees are reconciled before any transfer is possible.
  net:=greatest(a.product_value+a.delivery_value-a.commission-coalesce(a.processing_fee,0),0);
  select * into t from public.payment_operations where allocation_id=a.id and kind='transfer' for update;
  if t.id is not null and t.first_attempt_at is null and t.status='queued' then
    -- No provider call has begun: reduce held proceeds, not a needless transfer
    -- followed by a reversal. Release prior debt reservations with an audit trail.
    update public.seller_recovery_events set status='released',release_reason='refund_before_transfer'
      where operation_id=t.id and status='reserved';
    update public.payment_operations set amount=greatest(net-a.seller_refund_reserved-responsibility,0),
      details=details||jsonb_build_object('recovery_amount',0,'refund_adjusted',true) where id=t.id;
    held:=least(responsibility,greatest(net-a.seller_refund_reserved,0));
  else
    held:=least(responsibility,greatest(net-a.seller_refund_reserved-coalesce(t.amount+
      coalesce((t.details->>'recovery_amount')::integer,0),0),0));
  end if;
  insert into public.payment_operations(id,allocation_id,kind,request_key,amount,details)
    values(op_id,a.id,'refund',p_key,product_amount+p_delivery,jsonb_build_object(
      'request_lines',p_lines,'product',product_amount,'delivery',p_delivery,'commission_credit',credit,
      'seller_responsible',p_seller_responsible,'seller_responsibility',responsibility,'held_applied',held,'reason',p_reason));
  for line in select * from jsonb_array_elements(p_lines) loop
    insert into public.refund_lines(operation_id,order_item_id,product_amount,restore_quantity)
      values(op_id,(line->>'item_id')::uuid,(line->>'amount')::integer,(line->>'restore_quantity')::integer);
  end loop;
  update public.seller_allocations set refunded_product=refunded_product+product_amount,
    refunded_delivery=refunded_delivery+p_delivery,commission_credit=commission_credit+credit,
    seller_refund_reserved=seller_refund_reserved+responsibility where id=a.id;
  return op_id;
end $$;
revoke all on function public.request_payment_refund(uuid,text,jsonb,integer,text,boolean) from public;
grant execute on function public.request_payment_refund(uuid,text,jsonb,integer,text,boolean) to service_role;

-- Prevent rounding/restitution ambiguity while an earlier refund is unresolved.
-- Requests must serialize through the seller lock above.
create function private.guard_refund_serialization() returns trigger language plpgsql set search_path='' as $$
begin
  if new.kind='refund' and exists(select 1 from public.payment_operations where allocation_id=new.allocation_id
    and kind='refund' and status not in ('succeeded','failed')) then
    raise exception 'Reconcile the earlier refund before requesting another.';
  end if;
  return new;
end $$;
revoke all on function private.guard_refund_serialization() from public;
create trigger payment_refund_serialization before insert on public.payment_operations
for each row execute function private.guard_refund_serialization();

create function public.reserve_seller_transfer(p_seller_order_id uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare a public.seller_allocations; so public.seller_orders; p public.platform_payments;
  account text; op_id uuid; net integer; recovery integer:=0; take integer; d public.seller_debts;
begin
  select * into strict so from public.seller_orders where id=p_seller_order_id;
  perform private.payment_seller_lock(so.seller_user_id);
  perform public.sync_payment_order(so.order_id);
  select * into strict a from public.seller_allocations where seller_order_id=so.id for update;
  select id into op_id from public.payment_operations where allocation_id=a.id and kind='transfer';
  if found then return op_id; end if;
  -- Re-read lifecycle under lock. Only THIS seller's completion qualifies.
  select * into strict so from public.seller_orders where id=p_seller_order_id for update;
  select * into strict p from public.platform_payments where order_id=a.order_id;
  if so.fulfilment_status<>'delivered' or so.delivered_at is null or so.order_status<>'paid'
    or p.reconciliation_status<>'matched' or p.charge_id is null or a.processing_fee is null
    or exists(select 1 from public.payment_operations where allocation_id=a.id and kind='refund'
      and (status not in ('failed','succeeded') or (status='succeeded' and details->>'accounted' is distinct from 'true'))) then
    raise exception 'Seller allocation is not eligible for transfer.'; end if;
  select stripe_account_id into account from public.seller_payment_accounts where seller_user_id=a.seller_user_id;
  if account is null then raise exception 'Verified seller payment account required.'; end if;
  net:=greatest(a.product_value+a.delivery_value-a.commission-a.processing_fee-a.seller_refund_reserved,0);
  op_id:=gen_random_uuid();
  insert into public.payment_operations(id,allocation_id,kind,request_key,amount,details)
    values(op_id,a.id,'transfer','transfer:'||a.id,net,jsonb_build_object('destination',account,'charge',p.charge_id,'recovery_amount',0));
  -- Do not infer acceptance of the reimbursement clause from older terms.
  -- A reviewed version must be explicitly designated by a later approved change.
  if exists(select 1 from public.payment_policy pp join public.lister_terms_versions v on v.version=pp.recovery_terms_version
    join public.lister_terms_acceptances ac on ac.terms_version=v.version and ac.terms_sha256=v.content_sha256
    where pp.id and v.status='active' and ac.user_id=a.seller_user_id) then
    for d in select * from public.seller_debts where seller_user_id=a.seller_user_id and recovery_status='outstanding'
      and verified_at is not null order by created_at,id for update loop
      select least(net-recovery,d.original_amount-d.recovered_amount-coalesce((select sum(amount) from public.seller_recovery_events
        where debt_id=d.id and status='reserved'),0))::integer into take;
      if take>0 then
        insert into public.seller_recovery_events(debt_id,operation_id,amount,method,status)
          values(d.id,op_id,take,'future_proceeds','reserved');
        recovery:=recovery+take;
      end if;
      exit when recovery=net;
    end loop;
  end if;
  update public.payment_operations set amount=net-recovery,details=details||jsonb_build_object('recovery_amount',recovery) where id=op_id;
  return op_id;
end $$;
revoke all on function public.reserve_seller_transfer(uuid) from public;
grant execute on function public.reserve_seller_transfer(uuid) to service_role;

create function public.account_payment_refund(p_operation_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare op public.payment_operations; a public.seller_allocations; t public.payment_operations;
  prior_held integer; held integer; due integer; debt_amount integer; debt_id uuid; reversal_amount integer;
begin
  select a1.* into strict a from public.seller_allocations a1 join public.payment_operations o on o.allocation_id=a1.id where o.id=p_operation_id;
  perform private.payment_seller_lock(a.seller_user_id);
  select * into strict op from public.payment_operations where id=p_operation_id for update;
  if op.kind<>'refund' or op.status<>'succeeded' or op.details->>'accounted'='true' or a.processing_fee is null then return; end if;
  select * into t from public.payment_operations where allocation_id=a.id and kind='transfer';
  if t.id is not null and t.first_attempt_at is not null and t.status<>'succeeded' then return; end if;
  select coalesce(sum((details->>'held_applied')::integer),0)::integer into prior_held from public.payment_operations
    where allocation_id=a.id and kind='refund' and details->>'accounted'='true';
  due:=(op.details->>'seller_responsibility')::integer;
  held:=least(due,greatest(a.product_value+a.delivery_value-a.commission-a.processing_fee-prior_held-
    case when t.first_attempt_at is not null or t.status='succeeded' then coalesce(t.amount+coalesce((t.details->>'recovery_amount')::integer,0),0) else 0 end,0));
  debt_amount:=due-held;
  if debt_amount>0 then
    insert into public.seller_debts(seller_user_id,allocation_id,refund_operation_id,original_amount,reason,recovery_status,verified_at)
      values(a.seller_user_id,a.id,op.id,debt_amount,op.details->>'reason',
        case when t.amount>0 and (t.first_attempt_at is not null or t.status='succeeded') then 'pending_reversal' else 'outstanding' end,
        case when t.amount>0 and (t.first_attempt_at is not null or t.status='succeeded') then null else now() end) returning id into debt_id;
    if t.amount>0 and (t.first_attempt_at is not null or t.status='succeeded') then
      -- Reserve only the still-unreversed amount of this seller's transfer.
      select least(debt_amount,greatest(t.amount-coalesce(sum(amount),0),0))::integer into reversal_amount
        from public.payment_operations where allocation_id=a.id and kind='reversal' and status<>'failed';
      if reversal_amount>0 then
        insert into public.payment_operations(allocation_id,kind,request_key,amount,details)
          values(a.id,'reversal','reversal:'||op.id,reversal_amount,jsonb_build_object(
            'transfer_id',t.stripe_id,'refund_operation_id',op.id,'debt_id',debt_id));
      else
        update public.seller_debts set recovery_status='outstanding',verified_at=now() where id=debt_id;
      end if;
    end if;
  end if;
  update public.payment_operations set details=details||jsonb_build_object('accounted',true,'held_applied',held) where id=op.id;
end $$;
revoke all on function public.account_payment_refund(uuid) from public;
grant execute on function public.account_payment_refund(uuid) to service_role;

-- A durable lease, stable operation UUID idempotency key and hard retry horizon
-- protect the interval between Stripe success and database acknowledgement.
create function public.claim_payment_operation(p_operation_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare op public.payment_operations; a public.seller_allocations;
begin
  select a1.* into strict a from public.seller_allocations a1 join public.payment_operations o on o.allocation_id=a1.id where o.id=p_operation_id;
  perform private.payment_seller_lock(a.seller_user_id);
  -- A refund may have committed while this claim waited on the seller lock.
  -- Use the current reservation balance, never the pre-lock snapshot.
  select current_a.* into strict a from public.seller_allocations current_a where current_a.id=a.id;
  select * into strict op from public.payment_operations where id=p_operation_id for update;
  if op.status not in ('queued','running') or op.lease_until>now() then return null; end if;
  if op.kind='transfer' and op.first_attempt_at is null then
    if exists(select 1 from public.payment_operations where allocation_id=a.id and kind='refund'
      and (status not in ('failed','succeeded') or (status='succeeded' and details->>'accounted' is distinct from 'true'))) then return null; end if;
    if op.details->>'refund_adjusted'='true' then
      update public.payment_operations set amount=greatest(a.product_value+a.delivery_value-a.commission-a.processing_fee-a.seller_refund_reserved,0)
        where id=op.id returning * into op;
    end if;
  end if;
  if op.first_attempt_at < now()-interval '23 hours' then
    update public.payment_operations set status='attention',failure_code='idempotency_horizon' where id=op.id;
    return null;
  end if;
  update public.payment_operations set status='running',first_attempt_at=coalesce(first_attempt_at,now()),
    lease_until=now()+interval '5 minutes',lease_token=gen_random_uuid() where id=op.id returning * into op;
  return to_jsonb(op)||jsonb_build_object('seller_user_id',a.seller_user_id,'order_id',a.order_id,
    'payment_intent_id',(select payment_intent_id from public.platform_payments where order_id=a.order_id));
end $$;
revoke all on function public.claim_payment_operation(uuid) from public;
grant execute on function public.claim_payment_operation(uuid) to service_role;

create function public.settle_payment_operation(p_operation_id uuid,p_token uuid,p_status text,p_stripe_id text,
  p_amount integer,p_failure_code text default null) returns void
language plpgsql security invoker set search_path='' as $$
declare op public.payment_operations; a public.seller_allocations; d public.seller_debts;
  r record;
begin
  select a1.* into strict a from public.seller_allocations a1 join public.payment_operations o on o.allocation_id=a1.id where o.id=p_operation_id;
  perform private.payment_seller_lock(a.seller_user_id);
  select * into strict op from public.payment_operations where id=p_operation_id for update;
  if p_status not in ('succeeded','pending','failed') or p_amount is distinct from op.amount
    or (op.stripe_id is not null and op.stripe_id is distinct from p_stripe_id)
    or (p_token is not null and op.lease_token is distinct from p_token)
    or (p_status in ('succeeded','pending') and op.amount>0 and p_stripe_id is null) then
    raise exception 'Operation settlement mismatch.'; end if;
  if op.status='succeeded' then
    if p_status<>'succeeded' then raise exception 'Cannot downgrade successful operation.'; end if;
    return;
  end if;
  if op.status='failed' then
    if p_status<>'failed' then raise exception 'Failed operation needs manual reconciliation.'; end if;
    return;
  end if;
  if p_status='failed' and op.kind='transfer' then
    -- Keep the one transfer reservation and recoveries held until an operator
    -- reconciles it. Never mint a replacement transfer automatically.
    update public.payment_operations set status='attention',failure_code=p_failure_code,lease_until=null where id=op.id;
    return;
  end if;
  update public.payment_operations set status=p_status,stripe_id=p_stripe_id,failure_code=p_failure_code,
    lease_until=null,completed_at=case when p_status in ('succeeded','failed') then now() else null end where id=op.id;
  if op.kind='refund' and p_status='failed' then
    update public.seller_allocations set refunded_product=refunded_product-(op.details->>'product')::integer,
      refunded_delivery=refunded_delivery-(op.details->>'delivery')::integer,
      commission_credit=commission_credit-(op.details->>'commission_credit')::integer,
      seller_refund_reserved=seller_refund_reserved-(op.details->>'seller_responsibility')::integer where id=a.id;
  elsif op.kind='refund' and p_status='succeeded' then
    perform public.restore_payment_stock(op.id);
    perform public.account_payment_refund(op.id);
  elsif op.kind='reversal' then
    select * into strict d from public.seller_debts where id=(op.details->>'debt_id')::uuid for update;
    if d.seller_user_id<>a.seller_user_id then raise exception 'Cross-seller recovery prohibited.'; end if;
    if p_status='succeeded' then
      if op.amount>d.original_amount-d.recovered_amount then raise exception 'Recovery exceeds debt.'; end if;
      insert into public.seller_recovery_events(debt_id,operation_id,amount,method,status,applied_at)
        values(d.id,op.id,op.amount,'transfer_reversal','applied',now());
      update public.seller_debts set recovered_amount=recovered_amount+op.amount,
        recovery_status=case when recovered_amount+op.amount=original_amount then 'resolved' else 'outstanding' end,
        verified_at=case when recovered_amount+op.amount<original_amount then now() else verified_at end,
        resolved_at=case when recovered_amount+op.amount=original_amount then now() else null end where id=d.id;
    elsif p_status='failed' then
      update public.seller_debts set recovery_status='outstanding',verified_at=now() where id=d.id;
    end if;
  elsif op.kind='transfer' and p_status='succeeded' then
    for r in select e.*,de.seller_user_id,de.original_amount,de.recovered_amount from public.seller_recovery_events e
      join public.seller_debts de on de.id=e.debt_id where e.operation_id=op.id and e.status='reserved' order by e.debt_id for update of de loop
      if r.seller_user_id<>a.seller_user_id or r.amount>r.original_amount-r.recovered_amount then raise exception 'Invalid debt recovery.'; end if;
      update public.seller_recovery_events set status='applied',applied_at=now() where id=r.id;
      update public.seller_debts set recovered_amount=recovered_amount+r.amount,
        recovery_status=case when recovered_amount+r.amount=original_amount then 'resolved' else 'outstanding' end,
        resolved_at=case when recovered_amount+r.amount=original_amount then now() else null end where id=r.debt_id;
    end loop;
  end if;
end $$;
revoke all on function public.settle_payment_operation(uuid,uuid,text,text,integer,text) from public;
grant execute on function public.settle_payment_operation(uuid,uuid,text,text,integer,text) to service_role;

-- Seller cancellation uses the existing pending/packed inventory semantics.
-- It queues only this seller's remaining items/delivery, with durable reason.
create function public.cancel_seller_order_with_refund(p_seller_order_id uuid,p_expected_status text,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare so public.seller_orders; a public.seller_allocations; lines jsonb; op_id uuid;
begin
  if auth.uid() is null or not private.has_role('lister') or not exists(select 1 from public.profiles where id=auth.uid() and account_status='active') then
    raise exception 'Active lister access required.' using errcode='42501'; end if;
  select * into strict so from public.seller_orders where id=p_seller_order_id and seller_user_id=auth.uid();
  perform private.payment_seller_lock(so.seller_user_id);
  select * into strict so from public.seller_orders where id=p_seller_order_id for update;
  if so.fulfilment_status='cancelled' then
    return (select id from public.payment_operations where request_key='cancel:'||so.id);
  end if;
  if so.fulfilment_status::text<>p_expected_status or so.fulfilment_status not in ('pending','packed') then
    raise exception 'Only an unsent seller portion can be cancelled.'; end if;
  perform public.sync_payment_order(so.order_id);
  select * into strict a from public.seller_allocations where seller_order_id=so.id;
  -- Partial prior refunds require operator review rather than guessing stock.
  if a.refunded_product>0 or a.refunded_delivery>0 then raise exception 'Existing refunds require administrator review.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('item_id',id,'amount',line_total,'restore_quantity',quantity)),'[]') into lines
    from public.order_items where order_id=so.order_id and seller_user_id=so.seller_user_id;
  op_id:=public.request_payment_refund(so.id,'cancel:'||so.id,lines,a.delivery_value,p_reason,true);
  update public.seller_orders set fulfilment_status='cancelled',updated_at=now() where id=so.id;
  return op_id;
end $$;
revoke all on function public.cancel_seller_order_with_refund(uuid,text,text) from public;
grant execute on function public.cancel_seller_order_with_refund(uuid,text,text) to authenticated;

-- Read-only monitoring includes both weekly activity and all-time unresolved debt.
create view public.payment_weekly_metrics with (security_invoker=true) as
select date_trunc('week',created_at at time zone 'Europe/London') as week_start_london,
  count(*) filter(where kind='refund' and amount>0 and status='succeeded') as refund_count,
  coalesce(sum(amount) filter(where kind='refund' and status='succeeded'),0) as refund_amount,
  count(*) filter(where status='attention') as reconciliation_failures,
  count(*) filter(where kind='reversal' and status='failed') as failed_recoveries,
  count(*) filter(where status in ('running','pending','attention') or (kind='refund' and status='succeeded' and details->>'accounted' is distinct from 'true')) as unresolved_operations
from public.payment_operations group by 1;
create view public.seller_debt_metrics with (security_invoker=true) as
select count(*) filter(where verified_at is not null) as funded_shortfall_count,
  coalesce(sum(original_amount-recovered_amount) filter(where verified_at is not null),0) as funded_shortfall_outstanding,
  coalesce(sum(original_amount-recovered_amount),0) as outstanding_debt,
  avg(extract(epoch from (resolved_at-created_at))/86400) filter(where resolved_at is not null) as average_recovery_days,
  count(*) filter(where recovery_status<>'resolved') as unresolved_recoveries
from public.seller_debts;
revoke all on public.payment_weekly_metrics,public.seller_debt_metrics from public,anon,authenticated;
grant select on public.payment_weekly_metrics,public.seller_debt_metrics to service_role;

-- Per-seller commission rounding must reconcile to the platform payment.
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
    -- Preserve valid in-flight snapshots created by the former basket rounding
    -- rule. Their allocation discrepancy is held by match_payment_charge; never
    -- rewrite a historical financial snapshot or reject a genuinely paid order.
    or (checkout.holyhub_commission <> round(checkout.product_subtotal::numeric / 20)::integer
      and checkout.holyhub_commission <> (select coalesce(sum(round(s.subtotal / 20)),0)::integer from (select sum(line_total)::numeric as subtotal from public.checkout_session_items where checkout_session_id=checkout.id group by lister_user_id) s)) then
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

-- Prepared draft only. Publishing/activating a reviewed immutable contract and
-- setting payment_policy.recovery_terms_version are separate launch gates.
insert into public.lister_terms_versions(version,status,published_path)
values('2026-10-19-c11-prelaunch-v2','draft','/lister-terms') on conflict(version) do nothing;

-- Direct API status updates must not bypass cancellation's durable refund queue.
create function private.guard_payment_cancellation() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.fulfilment_status='cancelled' and old.fulfilment_status<>'cancelled' and not exists(
    select 1 from public.payment_operations o join public.seller_allocations a on a.id=o.allocation_id
    where a.seller_order_id=new.id and o.request_key='cancel:'||new.id and o.kind='refund'
  ) then raise exception 'Use the guarded cancellation and refund action.'; end if;
  return new;
end $$;
revoke all on function private.guard_payment_cancellation() from public;
create trigger seller_orders_guard_payment_cancellation before update of fulfilment_status on public.seller_orders
for each row execute function private.guard_payment_cancellation();

alter table public.seller_debts add column verified_shortfall integer not null default 0 check(verified_shortfall between 0 and original_amount);
-- Set once when the seller-responsible advance is verified, retaining the
-- original shortfall amount even after later recovery.
create function private.record_verified_shortfall() returns trigger language plpgsql set search_path='' as $$
begin
  if new.verified_at is not null and (tg_op='INSERT' or old.verified_at is null) then
    new.verified_shortfall:=new.original_amount-new.recovered_amount;
  end if;
  return new;
end $$;
revoke all on function private.record_verified_shortfall() from public;
create trigger seller_debts_verified_shortfall before insert or update on public.seller_debts
for each row execute function private.record_verified_shortfall();
create view public.seller_debt_weekly_metrics with (security_invoker=true) as
select date_trunc('week',verified_at at time zone 'Europe/London') as week_start_london,
  count(*) as funded_shortfall_count, sum(verified_shortfall) as funded_shortfall_amount
from public.seller_debts where verified_at is not null group by 1;
revoke all on public.seller_debt_weekly_metrics from public,anon,authenticated;
grant select on public.seller_debt_weekly_metrics to service_role;

alter table public.platform_payments add column reconciliation_hold boolean not null default false;
create function private.preserve_payment_reconciliation_hold() returns trigger language plpgsql set search_path='' as $$
begin
  if new.reconciliation_hold then new.reconciliation_status:='attention'; end if;
  return new;
end $$;
revoke all on function private.preserve_payment_reconciliation_hold() from public;
create trigger platform_payments_preserve_hold before insert or update on public.platform_payments
for each row execute function private.preserve_payment_reconciliation_hold();
-- Unknown external adjustments hold future payments for the same seller until
-- a verified reconciliation resolves them. They must not be silently netted.
create function private.guard_payment_transfer_hold() returns trigger language plpgsql set search_path='' as $$
begin
  if new.kind='transfer' and exists(select 1 from public.seller_allocations current_a
    join public.seller_allocations other_a on other_a.seller_user_id=current_a.seller_user_id
    join public.platform_payments p on p.order_id=other_a.order_id
    where current_a.id=new.allocation_id and p.reconciliation_hold) then
    raise exception 'Seller has an unresolved external financial adjustment.';
  end if;
  return new;
end $$;
revoke all on function private.guard_payment_transfer_hold() from public;
create trigger payment_operations_guard_transfer_hold before insert on public.payment_operations
for each row execute function private.guard_payment_transfer_hold();

create view public.payment_reconciliation with (security_invoker=true) as
select p.order_id,p.reconciliation_status,p.reconciliation_hold,
  p.amount as payment_amount,
  (select sum(a.product_value+a.delivery_value) from public.seller_allocations a where a.order_id=p.order_id) as allocated_amount,
  (select sum(o.amount) from public.payment_operations o join public.seller_allocations a on a.id=o.allocation_id
    where a.order_id=p.order_id and o.kind='refund' and o.status='succeeded') as customer_refunded_amount,
  (select count(*) from public.payment_operations o join public.seller_allocations a on a.id=o.allocation_id
    where a.order_id=p.order_id and o.status in ('pending','running','attention')) as unresolved_operations,
  (select count(*) from public.payment_operations o join public.seller_allocations a on a.id=o.allocation_id
    where a.order_id=p.order_id and o.kind='refund' and o.status='succeeded' and o.details->>'accounted' is distinct from 'true') as pending_refund_accounting,
  (select count(*) from public.refund_lines l join public.payment_operations o on o.id=l.operation_id
    join public.seller_allocations a on a.id=o.allocation_id where a.order_id=p.order_id and l.restored_at is null
      and l.restore_quantity>0 and o.status='succeeded') as outstanding_stock_restorations,
  (select count(*) from public.seller_debts d where d.allocation_id in (select id from public.seller_allocations where order_id=p.order_id)
    and d.recovered_amount<>coalesce((select sum(e.amount) from public.seller_recovery_events e where e.debt_id=d.id and e.status='applied'),0)) as debt_ledger_mismatches
from public.platform_payments p;
revoke all on public.payment_reconciliation from public,anon,authenticated;
grant select on public.payment_reconciliation to service_role;

-- New paid orders get financial allocations in the same existing payment
-- transaction. Historical orders are initialized only on explicit reconciliation.
create function private.sync_checkout_payment_ledger() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='paid' then
    perform public.sync_payment_order(o.id) from public.orders o where o.checkout_session_id=new.id;
  end if;
  return new;
end $$;
revoke all on function private.sync_checkout_payment_ledger() from public;
create trigger checkout_sessions_sync_payment_ledger after update of status on public.checkout_sessions
for each row execute function private.sync_checkout_payment_ledger();

create function private.guard_reserved_transfer_correction() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.fulfilment_status='delivered' and new.fulfilment_status<>'delivered' and exists(
    select 1 from public.seller_allocations a join public.payment_operations o on o.allocation_id=a.id
    where a.seller_order_id=new.id and o.kind='transfer'
  ) then raise exception 'A reserved seller transfer requires financial review before correcting delivery.'; end if;
  return new;
end $$;
revoke all on function private.guard_reserved_transfer_correction() from public;
create trigger seller_orders_guard_reserved_transfer_correction before update of fulfilment_status on public.seller_orders
for each row execute function private.guard_reserved_transfer_correction();

alter table public.refund_lines add column restoration_error text;
create function public.restore_payment_stock(p_operation_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare op public.payment_operations; a public.seller_allocations; l record; restored integer;
begin
  select a1.* into strict a from public.seller_allocations a1 join public.payment_operations o on o.allocation_id=a1.id where o.id=p_operation_id;
  perform private.payment_seller_lock(a.seller_user_id);
  select * into strict op from public.payment_operations where id=p_operation_id for update;
  if op.kind<>'refund' or op.status<>'succeeded' then return; end if;
    -- Product locks precede variant locks and are ordered consistently with
    -- checkout inventory mutation. A missing/deleted variant is never replaced
    -- by base stock. Stock issues are recorded separately from the paid refund.
    perform p.id from public.products p where p.id in (select oi.product_id from public.refund_lines rl
      join public.order_items oi on oi.id=rl.order_item_id where rl.operation_id=op.id and rl.restore_quantity>0) order by p.id for update;
    for l in select rl.*,oi.product_id,oi.variant_id,oi.variant_size from public.refund_lines rl
      join public.order_items oi on oi.id=rl.order_item_id where rl.operation_id=op.id and rl.restore_quantity>0 and rl.restored_at is null order by oi.variant_id,oi.id loop
      begin
      if l.product_id is null then raise exception 'Restoration product no longer exists.'; end if;
      if l.variant_size is not null then
        if l.variant_id is null then raise exception 'Restoration variant no longer exists.'; end if;
        update public.product_variants set stock_quantity=stock_quantity+l.restore_quantity,updated_at=now()
          where id=l.variant_id and product_id=l.product_id;
        get diagnostics restored=row_count;
        if restored<>1 then raise exception 'Restoration variant mismatch.'; end if;
        update public.products set stock_quantity=(select sum(stock_quantity) from public.product_variants where product_id=l.product_id) where id=l.product_id;
      else
        update public.products set stock_quantity=stock_quantity+l.restore_quantity where id=l.product_id;
      end if;
      update public.refund_lines set restored_at=now(),restoration_error=null where operation_id=op.id and order_item_id=l.order_item_id;
      exception when others then
        -- A paid refund must stay recorded even if inventory needs review.
        -- This subtransaction rolls back any partial restoration for this line.
        update public.refund_lines set restoration_error='inventory_reconciliation_required'
          where operation_id=op.id and order_item_id=l.order_item_id;
      end;
    end loop;
end $$;
revoke all on function public.restore_payment_stock(uuid) from public;
grant execute on function public.restore_payment_stock(uuid) to service_role;
