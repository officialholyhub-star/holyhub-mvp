-- Shared fixture helpers for rolled-back TEST checks and disposable local tests.
-- Call inside an explicit transaction. Uses only newly generated fixture IDs.
create function pg_temp.payment_fixture(p_base_stock integer default 9, p_size_stock integer default 7)
returns jsonb language plpgsql as $$
declare
  buyer uuid := gen_random_uuid(); seller_a uuid := gen_random_uuid(); seller_b uuid := gen_random_uuid();
  base_product uuid := gen_random_uuid(); apparel_product uuid := gen_random_uuid();
  selected_size uuid := gen_random_uuid(); other_size uuid := gen_random_uuid();
  checkout_id uuid := gen_random_uuid(); stripe_id text := 'cs_test_regression_' || checkout_id::text;
begin
  insert into auth.users(id, email, raw_user_meta_data)
  select id, 'payment-regression-' || id::text || '@example.invalid', '{"full_name":"Payment regression fixture"}'::jsonb
  from unnest(array[buyer, seller_a, seller_b]) id;
  insert into public.user_roles(user_id, role) values (seller_a, 'lister'), (seller_b, 'lister');
  insert into public.lister_storefronts(user_id, business_name, description, category_type)
  values (seller_a, 'Payment fixture A', 'Rolled back payment fixture', 'Books'),
    (seller_b, 'Payment fixture B', 'Rolled back payment fixture', 'Apparel');
  insert into public.products(id, lister_user_id, name, description, category_type, price, stock_quantity)
  values (base_product, seller_a, 'Book', 'Payment fixture', 'Books', 10, p_base_stock),
    (apparel_product, seller_b, 'Shirt', 'Payment fixture', 'Apparel', 15, p_size_stock + 5);
  insert into public.product_variants(id, product_id, size, stock_quantity)
  values (selected_size, apparel_product, 'M', p_size_stock), (other_size, apparel_product, 'L', 5);
  insert into public.checkout_sessions(id, user_id, stripe_checkout_session_id, amount_total,
    product_subtotal, delivery_total, holyhub_commission, seller_amount_total)
  values (checkout_id, buyer, stripe_id, 7200, 6500, 700, 325, 6175);
  insert into public.checkout_session_items(checkout_session_id, product_id, lister_user_id,
    product_name, unit_amount, quantity, line_total, variant_id, variant_size)
  values (checkout_id, base_product, seller_a, 'Book', 1000, 2, 2000, null, null),
    (checkout_id, apparel_product, seller_b, 'Shirt', 1500, 3, 4500, selected_size, 'M');
  insert into public.checkout_session_sellers(checkout_session_id, lister_user_id, seller_business_name, delivery_total)
  values (checkout_id, seller_a, 'Payment fixture A', 200), (checkout_id, seller_b, 'Payment fixture B', 500);
  return jsonb_build_object('checkout', checkout_id, 'stripe', stripe_id, 'buyer', buyer,
    'seller_a', seller_a, 'seller_b', seller_b, 'base', base_product, 'apparel', apparel_product,
    'selected', selected_size, 'other', other_size);
end;
$$;
create function pg_temp.pay_fixture(f jsonb, payment_status text default 'paid', amount integer default 7200)
returns uuid language sql as $$
  select public.process_checkout_payment(f->>'stripe', 'paid', payment_status, amount, 'gbp', 'pi_test_regression',
    '{"delivery_recipient_name":"Recipient","delivery_address_line1":"10 Fixture Road","delivery_address_line2":"Flat 2","delivery_city":"London","delivery_postcode":"SW1A 1AA","delivery_country":"GB"}'::jsonb);
$$;
