-- A-138: prospective fee responsibility; no historical rewrite or backfill.
BEGIN;
alter table public.payment_operations drop constraint payment_operations_processing_fee_credit_policy_version_check;
alter table public.payment_operations add constraint payment_operations_processing_fee_credit_policy_version_check
  check(processing_fee_credit_policy_version in (0,1,2));

-- Recognition evidence is immutable. Cash reservations are separate, append-only identities.
create table public.processing_fee_assessments (
  id uuid primary key default gen_random_uuid(),
  refund_operation_id uuid unique not null,
  allocation_id uuid not null references public.seller_allocations(id),
  fee_responsibility_bps integer not null check(fee_responsibility_bps between 0 and 10000),
  weighted_gross_before numeric not null check(weighted_gross_before>=0),
  weighted_gross_after numeric not null check(weighted_gross_after>=weighted_gross_before),
  eligible_gross_before integer not null check(eligible_gross_before>=0),
  eligible_gross_after integer not null check(eligible_gross_after>=eligible_gross_before),
  original_gross integer not null check(original_gross>=0),
  allocated_fee integer not null check(allocated_fee>=0),
  amount integer not null check(amount>=0),
  applicable_fee integer not null check(applicable_fee>=0),
  recognized_at timestamptz not null default now(),
  foreign key(refund_operation_id,allocation_id) references public.payment_operations(id,allocation_id)
);
create index on public.processing_fee_assessments(allocation_id);
create table public.processing_fee_payments_v2 (
  operation_id uuid primary key,
  assessment_id uuid not null references public.processing_fee_assessments(id),
  amount integer not null check(amount>0),
  destination text not null,
  created_at timestamptz not null default now(),
  foreign key(operation_id) references public.payment_operations(id) deferrable initially deferred
);
create index on public.processing_fee_payments_v2(assessment_id);
create table public.processing_fee_provider_reimbursements (
  id uuid primary key default gen_random_uuid(),
  provider_reference text unique not null check(provider_reference=btrim(provider_reference) and length(provider_reference) between 1 and 200),
  refund_operation_id uuid not null,
  allocation_id uuid not null references public.seller_allocations(id),
  amount integer not null check(amount>0),
  evidence text not null check(length(btrim(evidence)) between 1 and 1000),
  verified_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key(refund_operation_id,allocation_id) references public.payment_operations(id,allocation_id)
);
create index on public.processing_fee_provider_reimbursements(allocation_id);
create index on public.processing_fee_provider_reimbursements(refund_operation_id);
create table public.processing_fee_review_exceptions (
  id uuid primary key default gen_random_uuid(),
  reimbursement_id uuid not null references public.processing_fee_provider_reimbursements(id),
  operation_id uuid not null references public.payment_operations(id),
  reason text not null check(reason in ('rebate_after_payment','rebate_during_unknown_outcome')),
  created_at timestamptz not null default now(),
  unique(reimbursement_id,operation_id)
);

create function private.a138_entitlement(g integer,f integer,h numeric) returns integer
language sql immutable strict set search_path='' as $$
  select case when g=0 then 0 else least(f, floor(f::numeric*h/g+0.5)::integer) end
$$;

create function private.a138_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Fee evidence is append-only.'; end $$;

create function private.a138_guard_assessment() returns trigger language plpgsql set search_path='' as $$
declare a public.seller_allocations; r public.payment_operations; h numeric; g integer;
begin
  select * into strict a from public.seller_allocations where id=new.allocation_id;
  perform private.payment_seller_lock(a.seller_user_id);
  select * into strict r from public.payment_operations where id=new.refund_operation_id;
  select coalesce(sum(weighted_gross_after-weighted_gross_before),0),coalesce(sum(eligible_gross_after-eligible_gross_before),0)
    into h,g from public.processing_fee_assessments where allocation_id=a.id;
  if r.kind<>'refund' or r.status<>'succeeded' or r.processing_fee_credit_policy_version<>2
    or r.allocation_id<>a.id or new.fee_responsibility_bps is distinct from (r.details->>'fee_responsibility_bps')::integer
    or new.original_gross<>a.product_value+a.delivery_value or new.allocated_fee is distinct from a.processing_fee
    or new.weighted_gross_before<>h or new.weighted_gross_after<>h+r.amount::numeric*new.fee_responsibility_bps/10000
    or new.eligible_gross_before<>g or new.eligible_gross_after<>g+r.amount or new.eligible_gross_after>new.original_gross
    or new.amount<>private.a138_entitlement(new.original_gross,new.allocated_fee,new.weighted_gross_after)
       -private.a138_entitlement(new.original_gross,new.allocated_fee,h)
    or new.applicable_fee<>private.a138_entitlement(new.original_gross,new.allocated_fee,new.eligible_gross_after)
       -private.a138_entitlement(new.original_gross,new.allocated_fee,g) then
    raise exception 'Invalid A138 recognition.'; end if;
  return new;
end $$;
create trigger a138_assessment_guard before insert on public.processing_fee_assessments
  for each row execute function private.a138_guard_assessment();

-- Each rebate is attributed to the actual seller/refund loss, not another seller's fee.
create function private.a138_guard_reimbursement() returns trigger language plpgsql set search_path='' as $$
declare a public.seller_allocations; r public.payment_operations; total bigint; refund_total bigint;
begin
  select * into strict a from public.seller_allocations where id=new.allocation_id;
  perform private.payment_seller_lock(a.seller_user_id);
  select * into strict r from public.payment_operations where id=new.refund_operation_id;
  select coalesce(sum(amount),0),coalesce(sum(amount) filter(where refund_operation_id=r.id),0)
    into total,refund_total from public.processing_fee_provider_reimbursements where allocation_id=a.id;
  if r.kind<>'refund' or r.status<>'succeeded' or r.allocation_id<>a.id or a.processing_fee is null
    or total+new.amount>a.processing_fee
    or refund_total+new.amount>private.a138_entitlement(a.product_value+a.delivery_value,a.processing_fee,r.amount) then
    raise exception 'Provider reimbursement exceeds applicable seller fee.'; end if;
  return new;
end $$;
create trigger a138_reimbursement_guard before insert on public.processing_fee_provider_reimbursements
  for each row execute function private.a138_guard_reimbursement();

-- Reject missing assessments on newly created refunds, while allowing historical retries.
create or replace function public.request_payment_refund(p_seller_order_id uuid,p_key text,p_lines jsonb,p_delivery integer,
  p_reason text,p_seller_responsible boolean default true) returns uuid
language plpgsql security invoker set search_path='' as $$
declare r public.payment_operations; a public.seller_allocations;
begin
  select * into r from public.payment_operations where request_key=p_key;
  select * into a from public.seller_allocations where seller_order_id=p_seller_order_id;
  if r.id is null or r.processing_fee_credit_policy_version not in (0,1) or r.kind<>'refund'
    or r.allocation_id is distinct from a.id or r.details->'request_lines' is distinct from p_lines
    or (r.details->>'delivery')::integer is distinct from p_delivery or r.details->>'reason' is distinct from p_reason
    or (r.details->>'seller_responsible')::boolean is distinct from p_seller_responsible then
    raise exception 'Explicit processing-fee assessment required for new refunds.'; end if;
  return r.id;
end $$;
create function public.request_payment_refund(p_seller_order_id uuid,p_key text,p_lines jsonb,p_delivery integer,
  p_reason text,p_seller_responsible boolean,p_fee_responsibility_bps integer)
returns uuid language plpgsql security invoker set search_path='' as $$
declare a public.seller_allocations; so public.seller_orders; op public.payment_operations; t public.payment_operations;
  line jsonb; item public.order_items; product_amount integer:=0; credit integer; responsibility integer;
  held integer; net integer; previous_amount bigint; previous_stock bigint; op_id uuid:=gen_random_uuid();
begin
  if p_fee_responsibility_bps is null or p_fee_responsibility_bps not between 0 and 10000 then
    raise exception 'Explicit processing-fee responsibility basis points required.'; end if;
  select * into strict so from public.seller_orders where id=p_seller_order_id;
  perform private.payment_seller_lock(so.seller_user_id);
  perform public.sync_payment_order(so.order_id);
  select * into strict a from public.seller_allocations where seller_order_id=so.id for update;
  select * into op from public.payment_operations where request_key=p_key;
  if found then
    if op.allocation_id<>a.id or op.details->'request_lines' is distinct from p_lines
      or (op.details->>'delivery')::integer is distinct from p_delivery
      or op.details->>'reason' is distinct from p_reason
      or (op.details->>'seller_responsible')::boolean is distinct from p_seller_responsible
      or op.processing_fee_credit_policy_version<>2
      or (op.details->>'fee_responsibility_bps')::integer is distinct from p_fee_responsibility_bps then
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
  insert into public.payment_operations(id,allocation_id,kind,request_key,amount,processing_fee_credit_policy_version,details)
    values(op_id,a.id,'refund',p_key,product_amount+p_delivery,2,jsonb_build_object(
      'fee_responsibility_bps',p_fee_responsibility_bps,
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
create function private.a113_reserve_processing_fee_credit(p_refund_operation_id uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare a public.seller_allocations; r public.payment_operations; c public.processing_fee_credits;
  h integer; before_credit integer; after_credit integer; seq bigint; dest text; opid uuid;
begin
  select a1.* into strict a from public.seller_allocations a1 join public.payment_operations o on o.allocation_id=a1.id
    where o.id=p_refund_operation_id;
  perform private.payment_seller_lock(a.seller_user_id);
  select * into strict a from public.seller_allocations where id=a.id for update;
  select * into strict r from public.payment_operations where id=p_refund_operation_id for update;
  if r.kind<>'refund' or r.processing_fee_credit_policy_version<>1
    or r.details->>'seller_responsible' is distinct from 'false' then return null; end if;
  insert into public.processing_fee_credits(refund_operation_id,allocation_id,policy_version)
    values(r.id,a.id,1) on conflict(refund_operation_id) do nothing;
  select * into strict c from public.processing_fee_credits where refund_operation_id=r.id for update;
  if c.recognized_at is null then
    if r.status='failed' then
      update public.processing_fee_credits set status='void' where id=c.id;
      return c.id;
    end if;
    if r.status<>'succeeded' or a.processing_fee is null then return c.id; end if;
    select coalesce(max(eligible_gross_after),0),coalesce(sum(amount),0),coalesce(max(recognition_sequence),0)+1
      into h,before_credit,seq from public.processing_fee_credits where allocation_id=a.id and recognized_at is not null;
    if h::bigint+r.amount>a.product_value::bigint+a.delivery_value then raise exception 'Eligible refunds exceed original gross.'; end if;
    after_credit:=private.processing_fee_entitlement(a.product_value+a.delivery_value,a.processing_fee,h+r.amount);
    update public.processing_fee_credits set original_gross=a.product_value+a.delivery_value,allocated_fee=a.processing_fee,
      eligible_gross_before=h,eligible_gross_after=h+r.amount,credit_total_before=before_credit,credit_total_after=after_credit,
      recognition_sequence=seq,amount=after_credit-before_credit,recognized_at=now(),
      status=case when after_credit=before_credit then 'not_due' else 'payable' end
      where id=c.id returning * into c;
  end if;
  if c.amount>0 and c.payment_operation_id is null then
    select stripe_account_id into dest from public.seller_payment_accounts where seller_user_id=a.seller_user_id;
    if dest is null then
      update public.processing_fee_credits set status='attention' where id=c.id;
      return c.id;
    end if;
    insert into public.payment_operations(allocation_id,kind,request_key,amount,details)
      values(a.id,'fee_credit_transfer','fee-credit:'||r.id,c.amount,jsonb_build_object(
        'credit_id',c.id,'refund_operation_id',r.id,'policy_version',1,'destination',dest,'funding','holyhub')) returning id into opid;
    update public.processing_fee_credits set payment_operation_id=opid,status='payable' where id=c.id;
  end if;
  return c.id;
end $$;

create function private.a113_claim_payment_operation(p_operation_id uuid) returns jsonb
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
  if op.kind='fee_credit_transfer' then
    if not exists(select 1 from public.processing_fee_credits c where c.payment_operation_id=op.id
      and c.allocation_id=a.id and c.amount=op.amount and c.status in ('payable','paying')) then return null; end if;
    if op.first_attempt_at is not null then
      update public.payment_operations set status='attention',failure_code='credit_outcome_requires_reconciliation' where id=op.id;
      update public.processing_fee_credits set status='attention' where payment_operation_id=op.id;
      return null;
    end if;
    update public.processing_fee_credits set status='paying' where payment_operation_id=op.id;
  end if;
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


create function private.a113_settle_payment_operation(p_operation_id uuid,p_token uuid,p_status text,p_stripe_id text,
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
  if p_status='failed' and op.kind in ('transfer','fee_credit_transfer') then
    -- Keep the one transfer reservation and recoveries held until an operator
    -- reconciles it. Never mint a replacement transfer automatically.
    update public.payment_operations set status='attention',failure_code=p_failure_code,lease_until=null where id=op.id;
    if op.kind='fee_credit_transfer' then
      update public.processing_fee_credits set status='attention' where payment_operation_id=op.id;
    end if;
    return;
  end if;
  update public.payment_operations set status=p_status,stripe_id=p_stripe_id,failure_code=p_failure_code,
    lease_until=null,completed_at=case when p_status in ('succeeded','failed') then now() else null end where id=op.id;
  if op.kind='fee_credit_transfer' then
    update public.processing_fee_credits set
      status=case when p_status='succeeded' then 'paid' else 'attention' end,
      paid_at=case when p_status='succeeded' then now() else null end where payment_operation_id=op.id;
    if not found then raise exception 'Credit obligation missing.'; end if;
    return;
  end if;
  if op.kind='refund' and p_status='failed' then
    perform public.reserve_processing_fee_credit(op.id);
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




create or replace function private.guard_fee_credit_operation() returns trigger language plpgsql set search_path='' as $$
declare c public.processing_fee_credits;
begin
  if new.kind='fee_credit_transfer' and new.details->>'policy_version'='2' then
    if tg_op='UPDATE' and ((old.status in ('succeeded','failed') and new.status<>old.status)
      or (old.first_attempt_at is not null and new.first_attempt_at is distinct from old.first_attempt_at)
      or (old.stripe_id is not null and new.stripe_id is distinct from old.stripe_id)) then
      raise exception 'Terminal fee payment evidence is immutable.'; end if;
    if tg_op='UPDATE' and (new.kind,new.allocation_id,new.amount,new.details,new.request_key,new.processing_fee_credit_policy_version)
      is distinct from (old.kind,old.allocation_id,old.amount,old.details,old.request_key,old.processing_fee_credit_policy_version) then
      raise exception 'Credit payment identity is immutable.'; end if;
    if not exists(select 1 from public.processing_fee_payments_v2 x
      join public.processing_fee_assessments x1 on x1.id=x.assessment_id
      where x.operation_id=new.id and x.amount=new.amount and x1.allocation_id=new.allocation_id
        and new.details->>'credit_id'=x1.id::text
        and new.details->>'refund_operation_id'=x1.refund_operation_id::text
        and new.details->>'funding'='holyhub'
        and new.details->>'destination'=x.destination
        and new.request_key='fee-credit-v2:'||new.id::text) then
      raise exception 'Invalid A138 fee payment.'; end if;
    return new;
  end if;
  if tg_op='UPDATE' and old.kind='fee_credit_transfer' and
    (new.kind,new.allocation_id,new.amount,new.details,new.request_key,new.processing_fee_credit_policy_version)
      is distinct from (old.kind,old.allocation_id,old.amount,old.details,old.request_key,old.processing_fee_credit_policy_version) then
    raise exception 'Credit payment identity is immutable.';
  end if;
  if new.kind='fee_credit_transfer' then
    select * into strict c from public.processing_fee_credits where id=(new.details->>'credit_id')::uuid;
    if c.allocation_id<>new.allocation_id or c.amount<>new.amount or c.amount=0 or c.recognized_at is null
      or new.details->>'refund_operation_id' is distinct from c.refund_operation_id::text
      or new.details->>'policy_version' is distinct from c.policy_version::text
      or new.details->>'funding' is distinct from 'holyhub'
      or new.request_key<>'fee-credit:'||c.refund_operation_id
      or (c.payment_operation_id is not null and c.payment_operation_id<>new.id)
      or (tg_op='INSERT' and new.details->>'destination' is distinct from
        (select stripe_account_id from public.seller_payment_accounts a join public.seller_allocations s on s.seller_user_id=a.seller_user_id where s.id=c.allocation_id)) then
      raise exception 'Invalid fee-credit payment.'; end if;
  end if;
  return new;
end $$;

-- Compute exact fractional-penny losses before one cumulative half-up rounding.
-- Rebates can reduce loss, never increase entitlement; all versions share the hard fee cap.
create function private.a138_allocation_target(p_allocation_id uuid) returns integer
language sql stable set search_path='' as $$
  select greatest(least(
    coalesce((select floor(sum(least(
      case when c.original_gross=0 then 0 else c.allocated_fee::numeric*r.amount/c.original_gross*c.fee_responsibility_bps/10000 end,
      greatest(case when c.original_gross=0 then 0 else c.allocated_fee::numeric*r.amount/c.original_gross end
        -coalesce((select sum(b.amount) from public.processing_fee_provider_reimbursements b where b.refund_operation_id=r.id),0),0)))+0.5)::integer
      from public.processing_fee_assessments c join public.payment_operations r on r.id=c.refund_operation_id where c.allocation_id=a.id),0),
    coalesce(a.processing_fee,0)
      -coalesce((select sum(b.amount) from public.processing_fee_provider_reimbursements b where b.allocation_id=a.id),0)::integer
      -coalesce((select sum(c.amount) from public.processing_fee_credits c where c.allocation_id=a.id and c.recognized_at is not null),0)::integer
    ),0) from public.seller_allocations a where a.id=p_allocation_id
$$;

-- Allocate cumulative rounded entitlement to its originating refund, including rebate effects.
-- A rounding penny may move between assessments; the cumulative cap remains authoritative.
create function private.a138_assessment_target(p_assessment_id uuid) returns integer
language sql stable set search_path='' as $$
  with losses as (
    select c.id,c.eligible_gross_before,
      least(case when c.original_gross=0 then 0 else c.allocated_fee::numeric*r.amount/c.original_gross*c.fee_responsibility_bps/10000 end,
        greatest(case when c.original_gross=0 then 0 else c.allocated_fee::numeric*r.amount/c.original_gross end
          -coalesce((select sum(b.amount) from public.processing_fee_provider_reimbursements b where b.refund_operation_id=r.id),0),0)) as entitlement
    from public.processing_fee_assessments c join public.payment_operations r on r.id=c.refund_operation_id
    where c.allocation_id=(select allocation_id from public.processing_fee_assessments where id=p_assessment_id)
  ), cumulative as (
    select id,entitlement,sum(entitlement) over(order by eligible_gross_before,id) as total from losses
  ) select floor(total+0.5)::integer-floor(total-entitlement+0.5)::integer from cumulative where id=p_assessment_id
$$;

create function private.a138_available(p_assessment_id uuid) returns integer
language sql stable set search_path='' as $$
  select greatest(least(private.a138_assessment_target(c.id)
      -coalesce((select sum(p.amount) from public.processing_fee_payments_v2 p join public.payment_operations o on o.id=p.operation_id
        where p.assessment_id=c.id and o.status<>'failed'),0)::integer,
    private.a138_allocation_target(c.allocation_id)
      -coalesce((select sum(p.amount) from public.processing_fee_payments_v2 p join public.payment_operations o on o.id=p.operation_id
        join public.processing_fee_assessments x on x.id=p.assessment_id
        where x.allocation_id=c.allocation_id and o.status<>'failed'),0)::integer),0)
  from public.processing_fee_assessments c where c.id=p_assessment_id
$$;

create function private.a138_guard_payment() returns trigger language plpgsql set search_path='' as $$
declare c public.processing_fee_assessments; a public.seller_allocations;
begin
  select * into strict c from public.processing_fee_assessments where id=new.assessment_id;
  select * into strict a from public.seller_allocations where id=c.allocation_id;
  perform private.payment_seller_lock(a.seller_user_id);
  if exists(select 1 from public.processing_fee_payments_v2 p join public.payment_operations o on o.id=p.operation_id
    where p.assessment_id=c.id and o.status not in ('failed','succeeded'))
    or new.amount>private.a138_available(c.id)
    or new.destination is distinct from (select stripe_account_id from public.seller_payment_accounts where seller_user_id=a.seller_user_id) then
    raise exception 'Invalid A138 payment reservation.'; end if;
  return new;
end $$;
create trigger a138_payment_guard before insert on public.processing_fee_payments_v2
  for each row execute function private.a138_guard_payment();

create or replace function public.reserve_processing_fee_credit(p_refund_operation_id uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare a public.seller_allocations; r public.payment_operations; c public.processing_fee_assessments;
  h numeric; g integer; dest text; due integer; opid uuid:=gen_random_uuid();
begin
  select a1.* into strict a from public.seller_allocations a1 join public.payment_operations o on o.allocation_id=a1.id where o.id=p_refund_operation_id;
  perform private.payment_seller_lock(a.seller_user_id);
  select * into strict a from public.seller_allocations where id=a.id for update;
  select * into strict r from public.payment_operations where id=p_refund_operation_id for update;
  if r.processing_fee_credit_policy_version<>2 then return private.a113_reserve_processing_fee_credit(r.id); end if;
  if r.kind<>'refund' or r.status<>'succeeded' or a.processing_fee is null then return null; end if;
  select * into c from public.processing_fee_assessments where refund_operation_id=r.id;
  if not found then
    select coalesce(sum(weighted_gross_after-weighted_gross_before),0),coalesce(sum(eligible_gross_after-eligible_gross_before),0)
      into h,g from public.processing_fee_assessments where allocation_id=a.id;
    insert into public.processing_fee_assessments(refund_operation_id,allocation_id,fee_responsibility_bps,
      weighted_gross_before,weighted_gross_after,eligible_gross_before,eligible_gross_after,original_gross,allocated_fee,amount,applicable_fee)
      values(r.id,a.id,(r.details->>'fee_responsibility_bps')::integer,h,h+r.amount::numeric*(r.details->>'fee_responsibility_bps')::integer/10000,
        g,g+r.amount,a.product_value+a.delivery_value,a.processing_fee,
        private.a138_entitlement(a.product_value+a.delivery_value,a.processing_fee,h+r.amount::numeric*(r.details->>'fee_responsibility_bps')::integer/10000)
          -private.a138_entitlement(a.product_value+a.delivery_value,a.processing_fee,h),
        private.a138_entitlement(a.product_value+a.delivery_value,a.processing_fee,g+r.amount)
          -private.a138_entitlement(a.product_value+a.delivery_value,a.processing_fee,g)) returning * into c;
  end if;
  if exists(select 1 from public.processing_fee_payments_v2 p join public.payment_operations o on o.id=p.operation_id
      where p.assessment_id=c.id and o.status not in ('failed','succeeded')) then return c.id; end if;
  due:=private.a138_available(c.id);
  select stripe_account_id into dest from public.seller_payment_accounts where seller_user_id=a.seller_user_id;
  if due>0 and dest is not null then
    insert into public.processing_fee_payments_v2(operation_id,assessment_id,amount,destination) values(opid,c.id,due,dest);
    insert into public.payment_operations(id,allocation_id,kind,request_key,amount,processing_fee_credit_policy_version,details)
      values(opid,a.id,'fee_credit_transfer','fee-credit-v2:'||opid::text,due,2,jsonb_build_object(
        'credit_id',c.id,'refund_operation_id',r.id,'policy_version',2,'destination',dest,'funding','holyhub'));
  end if;
  return c.id;
end $$;

-- Serialize rebates with recognition, payment claiming and settlement. Never mutate paid evidence.
create function public.record_processing_fee_reimbursement(p_refund_operation_id uuid,p_provider_reference text,p_amount integer,
  p_evidence text,p_verified_by uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare a public.seller_allocations; b public.processing_fee_provider_reimbursements;
begin
  select a1.* into strict a from public.seller_allocations a1 join public.payment_operations r on r.allocation_id=a1.id where r.id=p_refund_operation_id;
  perform private.payment_seller_lock(a.seller_user_id);
  p_provider_reference:=btrim(p_provider_reference);
  p_evidence:=btrim(p_evidence);
  -- A global lock makes cross-seller reuse of one provider reference a deterministic conflict.
  perform pg_advisory_xact_lock(hashtextextended('a138-rebate:'||coalesce(p_provider_reference,''),0));
  select * into b from public.processing_fee_provider_reimbursements where provider_reference=p_provider_reference;
  if found then
    if (b.refund_operation_id,b.amount,b.evidence) is distinct from (p_refund_operation_id,p_amount,p_evidence) then
      raise exception 'Provider reimbursement identity conflict.'; end if;
    return b.id;
  end if;
  insert into public.processing_fee_provider_reimbursements(refund_operation_id,allocation_id,provider_reference,amount,evidence,verified_by)
    values(p_refund_operation_id,a.id,p_provider_reference,p_amount,p_evidence,p_verified_by) returning * into b;
  return b.id;
end $$;

-- Apply the same reconciliation even to a direct privileged insert.
create function private.a138_reimbursement_recorded() returns trigger language plpgsql set search_path='' as $$
declare a public.seller_allocations; b public.processing_fee_provider_reimbursements; o record; c record;
begin
  b:=new;
  select * into strict a from public.seller_allocations where id=b.allocation_id;
  for o in select * from public.payment_operations where allocation_id=a.id and kind='fee_credit_transfer' and status<>'failed' order by id for update loop
    if o.status='succeeded' or o.first_attempt_at is not null then
      insert into public.processing_fee_review_exceptions(reimbursement_id,operation_id,reason)
        values(b.id,o.id,case when o.status='succeeded' then 'rebate_after_payment' else 'rebate_during_unknown_outcome' end)
        on conflict do nothing;
    elsif o.details->>'policy_version'='2' then
      -- Supersede only a never-attempted reservation. Its identity and amount remain intact.
      update public.payment_operations set status='failed',failure_code='superseded_by_provider_rebate',completed_at=now() where id=o.id;
    end if;
  end loop;
  for c in select refund_operation_id from public.processing_fee_assessments where allocation_id=a.id order by eligible_gross_before,id loop
    perform public.reserve_processing_fee_credit(c.refund_operation_id);
  end loop;
  return new;
end $$;
create trigger a138_reimbursement_recorded after insert on public.processing_fee_provider_reimbursements
  for each row execute function private.a138_reimbursement_recorded();

create or replace function public.claim_payment_operation(p_operation_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o public.payment_operations; a public.seller_allocations; committed bigint;
begin
  select a1.* into strict a from public.seller_allocations a1 join public.payment_operations x on x.allocation_id=a1.id where x.id=p_operation_id;
  perform private.payment_seller_lock(a.seller_user_id);
  select * into strict o from public.payment_operations where id=p_operation_id for update;
  if o.kind='fee_credit_transfer' then
    if o.status not in ('queued','running') or o.lease_until>now() then return null; end if;
    if o.details->>'policy_version'='2' then
      select coalesce(sum(p.amount),0) into committed from public.processing_fee_payments_v2 p join public.payment_operations x on x.id=p.operation_id
        join public.processing_fee_assessments c on c.id=p.assessment_id where c.allocation_id=a.id and x.status<>'failed';
      if committed>private.a138_allocation_target(a.id) then
        update public.payment_operations set status='attention',failure_code='provider_rebate_requires_review' where id=o.id;
        return null;
      end if;
      if o.first_attempt_at is not null then
        update public.payment_operations set status='attention',failure_code='credit_outcome_requires_reconciliation' where id=o.id;
        return null;
      end if;
      update public.payment_operations set status='running',first_attempt_at=now(),lease_until=now()+interval '5 minutes',lease_token=gen_random_uuid()
        where id=o.id returning * into o;
      return to_jsonb(o)||jsonb_build_object('seller_user_id',a.seller_user_id,'order_id',a.order_id,
        'payment_intent_id',(select payment_intent_id from public.platform_payments where order_id=a.order_id));
    elsif exists(select 1 from public.processing_fee_provider_reimbursements where allocation_id=a.id)
      or coalesce((select sum(c.amount) from public.processing_fee_credits c where c.allocation_id=a.id),0)
        +coalesce((select sum(p.amount) from public.processing_fee_payments_v2 p join public.payment_operations x on x.id=p.operation_id
          join public.processing_fee_assessments c on c.id=p.assessment_id where c.allocation_id=a.id and x.status<>'failed'),0)>a.processing_fee then
      -- Historical payment identity is immutable; hold for explicit reconciliation.
      update public.payment_operations set status='attention',failure_code='provider_rebate_requires_review' where id=o.id;
      update public.processing_fee_credits set status='attention' where payment_operation_id=o.id and status<>'paid';
      return null;
    end if;
  end if;
  return private.a113_claim_payment_operation(p_operation_id);
end $$;

create or replace function public.settle_payment_operation(p_operation_id uuid,p_token uuid,p_status text,p_stripe_id text,
  p_amount integer,p_failure_code text default null) returns void language plpgsql security invoker set search_path='' as $$
declare o public.payment_operations; a public.seller_allocations; b record;
begin
  select a1.* into strict a from public.seller_allocations a1 join public.payment_operations x on x.allocation_id=a1.id where x.id=p_operation_id;
  perform private.payment_seller_lock(a.seller_user_id);
  select * into strict o from public.payment_operations where id=p_operation_id for update;
  if o.kind<>'fee_credit_transfer' or o.details->>'policy_version' is distinct from '2' then
    perform private.a113_settle_payment_operation(p_operation_id,p_token,p_status,p_stripe_id,p_amount,p_failure_code); return;
  end if;
  if p_status is null or p_status not in ('succeeded','pending','failed') or p_amount is distinct from o.amount
    or (o.stripe_id is not null and o.stripe_id is distinct from p_stripe_id)
    or (p_token is not null and o.lease_token is distinct from p_token)
    or (p_status in ('succeeded','pending') and p_stripe_id is null) then raise exception 'Operation settlement mismatch.'; end if;
  if o.status='succeeded' then
    if p_status<>'succeeded' then raise exception 'Cannot downgrade successful operation.'; end if; return;
  end if;
  if o.status='failed' then raise exception 'Superseded payment cannot settle.'; end if;
  update public.payment_operations set status=case when p_status='failed' then 'attention' else p_status end,
    stripe_id=p_stripe_id,failure_code=p_failure_code,lease_until=null,completed_at=case when p_status='succeeded' then now() else null end where id=o.id;
  -- A rebate can arrive between claim and acknowledgement. Preserve the provider outcome.
  if p_status='succeeded' then
    for b in select id from public.processing_fee_provider_reimbursements where allocation_id=a.id
      and created_at>=coalesce(o.first_attempt_at,o.created_at) loop
      insert into public.processing_fee_review_exceptions(reimbursement_id,operation_id,reason)
        values(b.id,o.id,'rebate_after_payment') on conflict do nothing;
    end loop;
  end if;
end $$;

-- Seller-initiated cancellations retain their existing seller-funded settlement and no fee credit.
create or replace function public.cancel_seller_order_with_refund(p_seller_order_id uuid,p_expected_status text,p_reason text)
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
  op_id:=public.request_payment_refund(so.id,'cancel:'||so.id,lines,a.delivery_value,p_reason,true,0);
  update public.seller_orders set fulfilment_status='cancelled',updated_at=now() where id=so.id;
  return op_id;
end $$;

-- Freeze the independent assessment on refunds even when ordinary accounting updates details.
create function private.a138_guard_refund() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' and old.kind='refund' and
    (new.kind,new.allocation_id,new.amount,new.request_key,new.processing_fee_credit_policy_version,new.details->'fee_responsibility_bps')
      is distinct from (old.kind,old.allocation_id,old.amount,old.request_key,old.processing_fee_credit_policy_version,old.details->'fee_responsibility_bps') then
    raise exception 'Refund fee assessment is immutable.'; end if;
  if new.kind='refund' and new.processing_fee_credit_policy_version=2 and
    (jsonb_typeof(new.details->'fee_responsibility_bps') is distinct from 'number'
      or (new.details->>'fee_responsibility_bps')::numeric<>trunc((new.details->>'fee_responsibility_bps')::numeric)
      or (new.details->>'fee_responsibility_bps')::numeric not between 0 and 10000) then
    raise exception 'Invalid fee responsibility basis points.'; end if;
  return new;
end $$;
create trigger a138_refund_guard before insert or update on public.payment_operations for each row execute function private.a138_guard_refund();

create view public.processing_fee_reconciliation_v2 with (security_invoker=true) as
select c.*,a.seller_user_id,a.order_id,r.details->>'reason' as refund_reason,
  coalesce((select sum(b.amount) from public.processing_fee_provider_reimbursements b where b.refund_operation_id=r.id),0) as provider_reimbursed_amount,
  private.a138_allocation_target(c.allocation_id) as allocation_current_entitlement,
  coalesce(p.paid,0) as paid_amount,coalesce(p.reserved,0) as reserved_amount,
  private.a138_available(c.id) as unreserved_amount,
  coalesce(p.attention,0) as attention_amount,
  exists(select 1 from public.processing_fee_review_exceptions e join public.payment_operations o on o.id=e.operation_id where o.allocation_id=a.id) as requires_review
from public.processing_fee_assessments c join public.seller_allocations a on a.id=c.allocation_id
join public.payment_operations r on r.id=c.refund_operation_id
left join lateral(select sum(x.amount) filter(where o.status='succeeded') as paid,
    sum(x.amount) filter(where o.status not in ('failed','succeeded')) as reserved,
    sum(x.amount) filter(where o.status='attention') as attention
  from public.processing_fee_payments_v2 x join public.payment_operations o on o.id=x.operation_id where x.assessment_id=c.id) p on true;

-- Allocation totals expose current obligations and late-paid excess without restating history.
create view public.processing_fee_allocation_reconciliation_v2 with (security_invoker=true) as
select a.id as allocation_id,a.seller_user_id,a.order_id,a.processing_fee as allocated_fee,
  coalesce(c.amount,0) as assessed_amount,private.a138_allocation_target(a.id) as current_entitlement,
  coalesce(p.paid,0) as paid_amount,coalesce(p.reserved,0) as reserved_amount,
  greatest(private.a138_allocation_target(a.id)-coalesce(p.paid,0),0) as outstanding_amount,
  greatest(coalesce(p.paid,0)-private.a138_allocation_target(a.id),0) as paid_excess_for_review,
  coalesce(b.amount,0) as provider_reimbursed_amount,
  exists(select 1 from public.processing_fee_review_exceptions e join public.payment_operations o on o.id=e.operation_id where o.allocation_id=a.id) as requires_review
from public.seller_allocations a
join lateral(select sum(amount) as amount from public.processing_fee_assessments where allocation_id=a.id) c on c.amount is not null
left join lateral(select sum(x.amount) filter(where o.status='succeeded') as paid,
    sum(x.amount) filter(where o.status not in ('failed','succeeded')) as reserved
  from public.processing_fee_payments_v2 x join public.payment_operations o on o.id=x.operation_id
  join public.processing_fee_assessments x1 on x1.id=x.assessment_id where x1.allocation_id=a.id) p on true
left join lateral(select sum(amount) as amount from public.processing_fee_provider_reimbursements where allocation_id=a.id) b on true;

-- Distinct event totals avoid multiplying rebates/exceptions through payment joins.
create view public.processing_fee_weekly_metrics_v2 with (security_invoker=true) as
with events as (
 select date_trunc('week',recognized_at at time zone 'Europe/London') as week_start_london,amount as assessed_amount,0 as paid_amount,0 as provider_reimbursed_amount,0 as review_count
 from public.processing_fee_assessments
 union all select date_trunc('week',o.completed_at at time zone 'Europe/London'),0,p.amount,0,0
 from public.processing_fee_payments_v2 p join public.payment_operations o on o.id=p.operation_id where o.status='succeeded'
 union all select date_trunc('week',created_at at time zone 'Europe/London'),0,0,amount,0 from public.processing_fee_provider_reimbursements
 union all select date_trunc('week',created_at at time zone 'Europe/London'),0,0,0,1 from public.processing_fee_review_exceptions
) select week_start_london,sum(assessed_amount) as assessed_amount,sum(paid_amount) as paid_amount,
  sum(provider_reimbursed_amount) as provider_reimbursed_amount,sum(review_count) as review_count from events group by 1;

-- Server-only invoker functions and evidence. No exposed browser grants or definer escalation.
do $$ declare t text; f record;
begin
  foreach t in array array['processing_fee_assessments','processing_fee_payments_v2','processing_fee_provider_reimbursements','processing_fee_review_exceptions'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
    execute format('grant select,insert on public.%I to service_role',t);
    execute format('create trigger a138_immutable before update or delete on public.%I for each row execute function private.a138_immutable()',t);
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='private' and (p.proname like 'a138_%%' or p.proname like 'a113_%%'))
      or (n.nspname='public' and p.proname in ('request_payment_refund','record_processing_fee_reimbursement','reserve_processing_fee_credit','claim_payment_operation','settle_payment_operation')) loop
    execute format('revoke all on function %s from public,anon,authenticated',f.sig);
    execute format('grant execute on function %s to service_role',f.sig);
  end loop;
end $$;
revoke all on public.processing_fee_reconciliation_v2,public.processing_fee_allocation_reconciliation_v2,public.processing_fee_weekly_metrics_v2 from public,anon,authenticated;
grant select on public.processing_fee_reconciliation_v2,public.processing_fee_allocation_reconciliation_v2,public.processing_fee_weekly_metrics_v2 to service_role;
COMMIT;
