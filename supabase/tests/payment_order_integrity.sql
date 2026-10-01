-- Run as postgres on TEST after 023, prefixed with payment_fixture.sql inside
-- BEGIN. The caller must ROLLBACK. No fixture or trigger survives this check.
create temporary table payment_test_results (check_name text primary key, passed boolean not null);
create function pg_temp.fail_payment_child() returns trigger language plpgsql as $$
begin
  if current_setting('holyhub.payment_test_fail_child', true) = 'on' then
    raise exception 'Injected child write failure';
  end if;
  return new;
end;
$$;
create trigger payment_regression_child_failure before insert on public.seller_orders
for each row execute function pg_temp.fail_payment_child();
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare f jsonb; o uuid; again uuid; rejected boolean;
begin
  f := pg_temp.payment_fixture();
  assert (select stock_quantity = 9 from public.products where id = (f->>'base')::uuid);
  assert (select stock_quantity = 7 from public.product_variants where id = (f->>'selected')::uuid);
  insert into payment_test_results values ('opening checkout does not decrement inventory', true);
  o := pg_temp.pay_fixture(f);
  assert (select count(*) = 1 from public.orders where stripe_checkout_session_id = f->>'stripe');
  assert (select count(*) = 2 from public.order_items where order_id = o);
  assert (select count(*) = 2 from public.seller_orders where order_id = o);
  assert (select count(distinct seller_user_id) = 2 from public.seller_orders where order_id = o);
  assert (select delivery_total = 200 and product_subtotal = 2000 and holyhub_commission = 100 and seller_amount = 1900
    from public.seller_orders where order_id = o and seller_user_id = (f->>'seller_a')::uuid);
  assert (select delivery_total = 500 and product_subtotal = 4500 and holyhub_commission = 225 and seller_amount = 4275
    from public.seller_orders where order_id = o and seller_user_id = (f->>'seller_b')::uuid);
  insert into payment_test_results values ('paid multi-seller order has exactly one parent and one child group per seller', true);
  assert (select stock_quantity = 7 from public.products where id = (f->>'base')::uuid);
  assert (select stock_quantity = 4 from public.product_variants where id = (f->>'selected')::uuid);
  assert (select stock_quantity = 5 from public.product_variants where id = (f->>'other')::uuid);
  assert (select stock_quantity = 9 from public.products where id = (f->>'apparel')::uuid);
  assert (select bool_and(stock_decremented and not variant_reserved) from public.checkout_session_items
    where checkout_session_id = (f->>'checkout')::uuid);
  insert into payment_test_results values ('non-Apparel and selected Apparel size decrement exactly once; other size unchanged', true);
  assert (select delivery_recipient_name = 'Recipient' and delivery_address_line1 = '10 Fixture Road'
    and delivery_address_line2 = 'Flat 2' and delivery_city = 'London' and delivery_postcode = 'SW1A 1AA'
    and delivery_country = 'GB' from public.orders where id = o);
  assert (select variant_size = 'M' and quantity = 3 and variant_id = (f->>'selected')::uuid
    from public.order_items where order_id = o and product_id = (f->>'apparel')::uuid);
  insert into payment_test_results values ('delivery address and variant size snapshots preserved', true);
  update public.seller_orders set fulfilment_status = 'dispatched', tracking_number = 'KEEP', fulfilment_note = 'Private fixture'
    where order_id = o and seller_user_id = (f->>'seller_a')::uuid;
  again := pg_temp.pay_fixture(f);
  assert again = o;
  assert (select count(*) = 2 from public.order_items where order_id = o);
  assert (select count(*) = 2 from public.seller_orders where order_id = o);
  assert (select stock_quantity = 7 from public.products where id = (f->>'base')::uuid);
  assert (select stock_quantity = 4 from public.product_variants where id = (f->>'selected')::uuid);
  assert (select tracking_number = 'KEEP' and fulfilment_status = 'dispatched' and fulfilment_note = 'Private fixture'
    from public.seller_orders where order_id = o and seller_user_id = (f->>'seller_a')::uuid);
  insert into payment_test_results values ('duplicate success preserves rows, inventory and existing fulfilment', true);
  perform public.process_checkout_payment(f->>'stripe', 'failed', 'unpaid', null, null, null, '{}');
  perform public.process_checkout_payment(f->>'stripe', 'cancelled', 'unpaid', null, null, null, '{}');
  assert (select status = 'paid' from public.checkout_sessions where id = (f->>'checkout')::uuid);
  insert into payment_test_results values ('late failure and expiry cannot downgrade paid checkout', true);

  f := pg_temp.payment_fixture();
  rejected := false;
  begin perform pg_temp.pay_fixture(f, 'unpaid'); exception when raise_exception then rejected := true; end;
  assert rejected;
  assert not exists (select 1 from public.orders where stripe_checkout_session_id = f->>'stripe');
  assert (select stock_quantity = 9 from public.products where id = (f->>'base')::uuid);
  assert (select stock_quantity = 7 from public.product_variants where id = (f->>'selected')::uuid);
  assert (select status = 'pending' from public.checkout_sessions where id = (f->>'checkout')::uuid);
  o := pg_temp.pay_fixture(f);
  assert o = pg_temp.pay_fixture(f);
  insert into payment_test_results values ('unpaid completion rejected without writes; later paid success fulfils once', true);

  f := pg_temp.payment_fixture();
  perform set_config('holyhub.payment_test_fail_child', 'on', true);
  rejected := false;
  begin perform pg_temp.pay_fixture(f); exception when raise_exception then rejected := true; end;
  perform set_config('holyhub.payment_test_fail_child', 'off', true);
  assert rejected;
  assert not exists (select 1 from public.orders where stripe_checkout_session_id = f->>'stripe');
  assert not exists (select 1 from public.order_items where product_id in ((f->>'base')::uuid, (f->>'apparel')::uuid));
  assert (select stock_quantity = 9 from public.products where id = (f->>'base')::uuid);
  assert (select stock_quantity = 7 from public.product_variants where id = (f->>'selected')::uuid);
  assert (select status = 'pending' from public.checkout_sessions where id = (f->>'checkout')::uuid);
  o := pg_temp.pay_fixture(f);
  assert (select count(*) = 2 from public.seller_orders where order_id = o);
  insert into payment_test_results values ('child write failure rolls back parent/items/status/stock; retry succeeds', true);

  f := pg_temp.payment_fixture(1, 7);
  rejected := false;
  begin perform pg_temp.pay_fixture(f); exception when raise_exception then rejected := true; end;
  assert rejected;
  assert not exists (select 1 from public.orders where stripe_checkout_session_id = f->>'stripe');
  assert (select stock_quantity = 1 from public.products where id = (f->>'base')::uuid);
  assert (select stock_quantity = 7 from public.product_variants where id = (f->>'selected')::uuid);
  assert (select status = 'pending' from public.checkout_sessions where id = (f->>'checkout')::uuid);
  assert (select bool_and(not stock_decremented) from public.checkout_session_items where checkout_session_id = (f->>'checkout')::uuid);
  insert into payment_test_results values ('insufficient base stock rolls back all sellers without negative inventory', true);
  f := pg_temp.payment_fixture(9, 2);
  rejected := false;
  begin perform pg_temp.pay_fixture(f); exception when raise_exception then rejected := true; end;
  assert rejected;
  assert not exists (select 1 from public.orders where stripe_checkout_session_id = f->>'stripe');
  assert (select stock_quantity = 9 from public.products where id = (f->>'base')::uuid);
  assert (select stock_quantity = 2 from public.product_variants where id = (f->>'selected')::uuid);
  insert into payment_test_results values ('insufficient Apparel stock rolls back other seller stock and all order writes', true);

  f := pg_temp.payment_fixture();
  rejected := false;
  begin perform pg_temp.pay_fixture(f, 'paid', 7199); exception when raise_exception then rejected := true; end;
  assert rejected and not exists (select 1 from public.orders where stripe_checkout_session_id = f->>'stripe');
  insert into payment_test_results values ('amount mismatch rejects before paid status or stock changes', true);

  -- Reproduce an old partial parent with stock already decremented. Repair must
  -- add missing children without decrementing again or rewriting its address.
  insert into public.orders(user_id, checkout_session_id, stripe_checkout_session_id, order_status,
    product_subtotal, delivery_total, total_amount, holyhub_commission, seller_amount_total, delivery_address_line1)
  values ((f->>'buyer')::uuid, (f->>'checkout')::uuid, f->>'stripe', 'paid', 6500, 700, 7200, 325, 6175, 'Keep existing address') returning id into o;
  update public.checkout_sessions set status = 'paid' where id = (f->>'checkout')::uuid;
  perform public.process_paid_checkout_stock((f->>'checkout')::uuid);
  assert o = pg_temp.pay_fixture(f);
  assert (select count(*) = 2 from public.order_items where order_id = o);
  assert (select count(*) = 2 from public.seller_orders where order_id = o);
  assert (select stock_quantity = 7 from public.products where id = (f->>'base')::uuid);
  assert (select stock_quantity = 4 from public.product_variants where id = (f->>'selected')::uuid);
  assert (select delivery_address_line1 = 'Keep existing address' from public.orders where id = o);
  insert into payment_test_results values ('legacy partial order repair adds missing children without rewriting parent or repeating stock', true);

  -- Use the actual browser role, including a normal lister identity.
  assert not has_function_privilege('anon', 'public.process_checkout_payment(text,text,text,integer,text,text,jsonb)', 'execute');
  assert not has_function_privilege('authenticated', 'public.process_checkout_payment(text,text,text,integer,text,text,jsonb)', 'execute');
  assert has_function_privilege('service_role', 'public.process_checkout_payment(text,text,text,integer,text,text,jsonb)', 'execute');
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  rejected := false;
  begin perform pg_temp.pay_fixture(f); exception when insufficient_privilege then rejected := true; end;
  assert rejected;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  insert into payment_test_results values ('RPC privileges deny anon/authenticated and enforce service-role guard', true);

  -- Verify null base variants cannot bypass the unique key.
  rejected := false;
  begin insert into public.order_items(order_id, product_id, seller_user_id, product_name, unit_amount, quantity, line_total)
    select order_id, product_id, seller_user_id, product_name, unit_amount, quantity, line_total
    from public.order_items where order_id = o and variant_id is null;
  exception when unique_violation then rejected := true; end;
  assert rejected;
  rejected := false;
  begin insert into public.seller_orders(order_id, seller_user_id, seller_business_name, product_subtotal,
    delivery_total, total_amount, holyhub_commission, seller_amount)
    select order_id, seller_user_id, seller_business_name, product_subtotal, delivery_total, total_amount, holyhub_commission, seller_amount
    from public.seller_orders where order_id = o limit 1;
  exception when unique_violation then rejected := true; end;
  assert rejected;
  insert into payment_test_results values ('database uniqueness blocks duplicate base items and seller orders', true);
  f := pg_temp.payment_fixture();
  o := pg_temp.pay_fixture(f);
  insert into public.order_items(order_id, product_id, seller_user_id, product_name, unit_amount, quantity, line_total, variant_id, variant_size)
  values (o, (f->>'apparel')::uuid, (f->>'seller_b')::uuid, 'Shirt', 1500, 1, 1500, (f->>'other')::uuid, 'L');
  delete from public.product_variants where product_id = (f->>'apparel')::uuid;
  assert (select count(*) = 2 from public.order_items where order_id = o and product_id = (f->>'apparel')::uuid and variant_id is null);
  assert (select array_agg(variant_size order by variant_size) = array['L','M'] from public.order_items
    where order_id = o and product_id = (f->>'apparel')::uuid);
  insert into payment_test_results values ('stable size uniqueness preserves distinct historical sizes after variant FK removal', true);
end;
$$;
select jsonb_agg(to_jsonb(result) order by check_name) as verification from payment_test_results result;
