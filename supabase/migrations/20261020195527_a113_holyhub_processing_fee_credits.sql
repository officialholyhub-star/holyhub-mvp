-- A-113: prospective, HolyHub-funded processing-fee credits. No backfill.
BEGIN;
alter table public.payment_operations
  add column processing_fee_credit_policy_version smallint not null default 0
    check(processing_fee_credit_policy_version in (0,1));
alter table public.payment_operations alter column processing_fee_credit_policy_version set default 1;
alter table public.payment_operations drop constraint payment_operations_kind_check;
alter table public.payment_operations add constraint payment_operations_kind_check
  check(kind in ('transfer','refund','reversal','fee_credit_transfer'));
alter table public.payment_operations add constraint payment_operations_id_allocation_unique unique(id,allocation_id);

create table public.processing_fee_credits (
  id uuid primary key default gen_random_uuid(),
  refund_operation_id uuid unique not null,
  allocation_id uuid not null references public.seller_allocations(id) on delete restrict,
  policy_version smallint not null check(policy_version=1),
  recognition_sequence bigint,
  original_gross integer check(original_gross>=0),
  allocated_fee integer check(allocated_fee>=0),
  eligible_gross_before integer check(eligible_gross_before>=0),
  eligible_gross_after integer check(eligible_gross_after>=eligible_gross_before and eligible_gross_after<=original_gross),
  credit_total_before integer check(credit_total_before>=0),
  credit_total_after integer check(credit_total_after>=credit_total_before and credit_total_after<=allocated_fee),
  amount integer not null default 0 check(amount>=0),
  status text not null default 'awaiting_evidence'
    check(status in ('awaiting_evidence','payable','paying','paid','not_due','void','attention')),
  payment_operation_id uuid unique,
  created_at timestamptz not null default now(),
  recognized_at timestamptz,
  paid_at timestamptz,
  foreign key(refund_operation_id,allocation_id) references public.payment_operations(id,allocation_id) on delete restrict,
  foreign key(payment_operation_id,allocation_id) references public.payment_operations(id,allocation_id) on delete restrict,
  unique(allocation_id,recognition_sequence),
  check((recognized_at is null and recognition_sequence is null and original_gross is null and allocated_fee is null
      and eligible_gross_before is null and eligible_gross_after is null and credit_total_before is null
      and credit_total_after is null and amount=0 and status in ('awaiting_evidence','void'))
    or (recognized_at is not null and recognition_sequence is not null and original_gross is not null
      and allocated_fee is not null and eligible_gross_before is not null and eligible_gross_after is not null
      and credit_total_before is not null and credit_total_after is not null
      and amount=credit_total_after-credit_total_before and status in ('payable','paying','paid','not_due','attention'))),
  check((status='paid')=(paid_at is not null)),
  check(status not in ('paying','paid') or payment_operation_id is not null),
  check(status<>'not_due' or amount=0)
);
create index processing_fee_credits_queue_idx on public.processing_fee_credits(status,created_at);
alter table public.processing_fee_credits enable row level security;
revoke all on public.processing_fee_credits from public,anon,authenticated,service_role;
grant select,insert,update on public.processing_fee_credits to service_role;

-- Numeric integer division: floor((2*f*H + G)/(2*G)) is exact half-up.
create function private.processing_fee_entitlement(g integer,f integer,h integer) returns integer
language sql immutable strict set search_path='' as $$
  select case when g=0 then 0 else least(f,div(2*f::numeric*h+g,2*g::numeric)::integer) end
$$;
revoke all on function private.processing_fee_entitlement(integer,integer,integer) from public,anon,authenticated;
grant execute on function private.processing_fee_entitlement(integer,integer,integer) to service_role;

-- Enforce same-allocation links, immutable recognition, and the cumulative cap
-- even if a service caller tries to bypass the reservation RPC.
create function private.guard_processing_fee_credit() returns trigger
language plpgsql set search_path='' as $$
declare a public.seller_allocations; r public.payment_operations; p public.payment_operations; h integer; c integer;
begin
  select * into strict a from public.seller_allocations where id=new.allocation_id;
  perform private.payment_seller_lock(a.seller_user_id);
  select * into strict r from public.payment_operations where id=new.refund_operation_id;
  if r.kind<>'refund' or r.allocation_id<>a.id or r.processing_fee_credit_policy_version<>1
    or r.details->>'seller_responsible' is distinct from 'false' or new.policy_version<>1 then
    raise exception 'Ineligible processing-fee credit.'; end if;
  if tg_op='UPDATE' then
    if (new.id,new.refund_operation_id,new.allocation_id,new.policy_version,new.created_at)
      is distinct from (old.id,old.refund_operation_id,old.allocation_id,old.policy_version,old.created_at)
      or (old.payment_operation_id is not null and new.payment_operation_id is distinct from old.payment_operation_id)
      or (old.recognized_at is not null and
        (new.recognized_at,new.recognition_sequence,new.original_gross,new.allocated_fee,new.eligible_gross_before,
         new.eligible_gross_after,new.credit_total_before,new.credit_total_after,new.amount) is distinct from
        (old.recognized_at,old.recognition_sequence,old.original_gross,old.allocated_fee,old.eligible_gross_before,
         old.eligible_gross_after,old.credit_total_before,old.credit_total_after,old.amount))
      or (old.status in ('paid','not_due','void') and new.status<>old.status)
      or (old.paid_at is not null and new.paid_at is distinct from old.paid_at) then
      raise exception 'Processing-fee credit evidence is immutable.'; end if;
  end if;
  if new.recognized_at is not null and (tg_op='INSERT' or old.recognized_at is null) then
    select coalesce(max(eligible_gross_after),0),coalesce(sum(amount),0) into h,c
      from public.processing_fee_credits where allocation_id=a.id and recognized_at is not null and id<>new.id;
    if r.status<>'succeeded' or a.processing_fee is null
      or new.original_gross<>a.product_value+a.delivery_value or new.allocated_fee<>a.processing_fee
      or new.eligible_gross_before<>h or new.credit_total_before<>c
      or new.eligible_gross_after<>h+r.amount
      or new.credit_total_after<>private.processing_fee_entitlement(new.original_gross,new.allocated_fee,new.eligible_gross_after)
      or c+new.amount>a.processing_fee then raise exception 'Invalid cumulative processing-fee credit.'; end if;
  end if;
  if new.payment_operation_id is not null then
    select * into strict p from public.payment_operations where id=new.payment_operation_id;
    if p.kind<>'fee_credit_transfer' or p.allocation_id<>a.id or p.amount<>new.amount
      or p.details->>'credit_id'<>new.id::text then raise exception 'Invalid credit payment link.'; end if;
    if (new.status='paid') is distinct from (p.status='succeeded') then raise exception 'Credit settlement mismatch.'; end if;
  end if;
  return new;
end $$;
revoke all on function private.guard_processing_fee_credit() from public,anon,authenticated;
create trigger processing_fee_credit_guard before insert or update on public.processing_fee_credits
for each row execute function private.guard_processing_fee_credit();

create function public.reserve_processing_fee_credit(p_refund_operation_id uuid) returns uuid
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
revoke all on function public.reserve_processing_fee_credit(uuid) from public,anon,authenticated;
grant execute on function public.reserve_processing_fee_credit(uuid) to service_role;

create function private.guard_fee_credit_operation() returns trigger language plpgsql set search_path='' as $$
declare c public.processing_fee_credits;
begin
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
revoke all on function private.guard_fee_credit_operation() from public,anon,authenticated;
create trigger fee_credit_operation_guard before insert or update on public.payment_operations
for each row execute function private.guard_fee_credit_operation();

create or replace function public.account_payment_refund(p_operation_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare op public.payment_operations; a public.seller_allocations; t public.payment_operations;
  prior_held integer; held integer; due integer; debt_amount integer; debt_id uuid; reversal_amount integer;
begin
  select a1.* into strict a from public.seller_allocations a1 join public.payment_operations o on o.allocation_id=a1.id where o.id=p_operation_id;
  perform private.payment_seller_lock(a.seller_user_id);
  select * into strict op from public.payment_operations where id=p_operation_id for update;
  perform public.reserve_processing_fee_credit(op.id);
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

create or replace function public.claim_payment_operation(p_operation_id uuid) returns jsonb
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

create or replace function public.settle_payment_operation(p_operation_id uuid,p_token uuid,p_status text,p_stripe_id text,
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



REVOKE EXECUTE ON FUNCTION
  public.process_checkout_payment(text,text,text,integer,text,text,jsonb),
  public.match_payment_charge(uuid,text,text,integer,integer),
  public.sync_payment_order(uuid),
  public.request_payment_refund(uuid,text,jsonb,integer,text,boolean),
  public.reserve_seller_transfer(uuid),
  public.account_payment_refund(uuid),
  public.claim_payment_operation(uuid),
  public.settle_payment_operation(uuid,uuid,text,text,integer,text),
  public.restore_payment_stock(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.process_checkout_payment(text,text,text,integer,text,text,jsonb),
  public.match_payment_charge(uuid,text,text,integer,integer),
  public.sync_payment_order(uuid),
  public.request_payment_refund(uuid,text,jsonb,integer,text,boolean),
  public.reserve_seller_transfer(uuid),
  public.account_payment_refund(uuid),
  public.claim_payment_operation(uuid),
  public.settle_payment_operation(uuid,uuid,text,text,integer,text),
  public.restore_payment_stock(uuid)
TO service_role;

REVOKE EXECUTE ON FUNCTION
  public.cancel_seller_order_with_refund(uuid,text,text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.cancel_seller_order_with_refund(uuid,text,text)
TO authenticated, service_role;



create view public.processing_fee_credit_reconciliation with (security_invoker=true) as
select c.*,a.seller_user_id,a.order_id,a.processing_fee as original_seller_allocated_fee,
  so.stripe_processing_fee as seller_order_allocated_fee,o.details->>'reason' as refund_reason,
  o.details->>'seller_responsible' as seller_responsible,o.status as refund_status,
  p.stripe_processing_fee as original_provider_processing_fee,
  pay.status as payment_status,pay.stripe_id as provider_transfer_id,pay.failure_code,
  case when c.recognized_at is not null then c.amount else 0 end as recognized_amount,
  case when c.status='paid' then c.amount else 0 end as paid_amount,
  case when c.recognized_at is not null and c.status<>'paid' then c.amount else 0 end as outstanding_payable_amount,
  (c.credit_total_after is not distinct from private.processing_fee_entitlement(c.original_gross,c.allocated_fee,c.eligible_gross_after)) as formula_matches,
  (select coalesce(sum(x.amount),0)<=a.processing_fee from public.processing_fee_credits x where x.allocation_id=a.id) as within_allocated_fee,
  (c.status='paid') is not distinct from coalesce(pay.status='succeeded',false) as settlement_matches,
  (select sum(x.processing_fee) from public.seller_allocations x where x.order_id=a.order_id)=p.stripe_processing_fee as original_fee_allocation_matches
from public.processing_fee_credits c join public.seller_allocations a on a.id=c.allocation_id
join public.seller_orders so on so.id=a.seller_order_id
join public.payment_operations o on o.id=c.refund_operation_id
join public.orders p on p.id=a.order_id
left join public.payment_operations pay on pay.id=c.payment_operation_id;

-- Recognition and cash payment use their own London weeks, not creation week.
create view public.processing_fee_credit_weekly_metrics with (security_invoker=true) as
with events as (
  select date_trunc('week',recognized_at at time zone 'Europe/London') as week_start_london,
    amount as recognized_amount,1 as recognized_count,0 as paid_amount,0 as paid_count,
    case when status<>'paid' then amount else 0 end as outstanding_payable_amount,
    case when status<>'paid' and amount>0 then 1 else 0 end as outstanding_payable_count,
    case when status='attention' then amount else 0 end as attention_amount,
    case when status='attention' then 1 else 0 end as attention_count
  from public.processing_fee_credits where recognized_at is not null
  union all
  select date_trunc('week',paid_at at time zone 'Europe/London'),0,0,amount,1,0,0,0,0
  from public.processing_fee_credits where paid_at is not null
)
select week_start_london,sum(recognized_amount) as recognized_amount,sum(recognized_count) as recognized_count,
  sum(paid_amount) as paid_amount,sum(paid_count) as paid_count,
  sum(outstanding_payable_amount) as outstanding_payable_amount,sum(outstanding_payable_count) as outstanding_payable_count,
  sum(attention_amount) as attention_amount,sum(attention_count) as attention_count
from events group by 1;
revoke all on public.processing_fee_credit_reconciliation,public.processing_fee_credit_weekly_metrics from public,anon,authenticated;
grant select on public.processing_fee_credit_reconciliation,public.processing_fee_credit_weekly_metrics to service_role;
COMMIT;
