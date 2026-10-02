-- Execute ONLY against verified holyhub-stage4-test, or disposable local DB.
-- All fixture users/products and edits are rolled back. No Storage writes.
begin;
create temporary table bulk_image_checks(check_name text, passed boolean);
grant all on bulk_image_checks to authenticated;
create function pg_temp.check_bulk_image(name text, passed boolean)
returns void language plpgsql as $$ begin
  if passed is distinct from true then raise exception 'Bulk image regression failed: %', name; end if;
  insert into bulk_image_checks values (name, passed);
end $$;

do $$ declare seller uuid := gen_random_uuid(); other_seller uuid := gen_random_uuid(); begin
  insert into auth.users(id, email, raw_user_meta_data)
  select id, 'bulk-image-regression-' || id::text || '@example.invalid', '{}'::jsonb
  from unnest(array[seller, other_seller]) id;
  insert into public.user_roles(user_id, role) values (seller, 'lister'), (other_seller, 'lister');
  insert into public.lister_storefronts(user_id, business_name, description, category_type)
  values (seller, 'Bulk image fixture', 'Rolled back fixture', 'Books'),
    (other_seller, 'Other bulk fixture', 'Rolled back fixture', 'Books');
  perform set_config('holyhub.bulk_seller', seller::text, true);
  perform set_config('holyhub.bulk_other', other_seller::text, true);
  perform set_config('request.jwt.claim.sub', seller::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', seller, 'role', 'authenticated')::text, true);
end $$;
set local role authenticated;
do $$ declare
  seller uuid := current_setting('holyhub.bulk_seller')::uuid;
  other_seller uuid := current_setting('holyhub.bulk_other')::uuid;
  first_id uuid := gen_random_uuid(); five_id uuid := gen_random_uuid(); failed_id uuid := gen_random_uuid();
  sku_failed_id uuid := gen_random_uuid(); variant_failed_id uuid := gen_random_uuid(); legacy_id uuid := gen_random_uuid();
  product jsonb := '{"name":"Book","description":"Fixture book","category_type":"Books","price":5,"stock_quantity":3,"sku":"ONE"}';
  prefix text := 'https://ueqwzpuiuidihzhtbmvo.supabase.co/storage/v1/object/public/product-images/';
  images text[]; manual text; result text; rejected boolean;
begin
  perform pg_temp.check_bulk_image('anonymous cannot execute', not has_function_privilege('anon',
    'public.import_product_csv_row(uuid,jsonb,text[],integer[],text[])', 'execute'));
  images := array[prefix || seller::text || '/one.png'];
  result := public.import_product_csv_row(first_id, product, array[]::text[], array[]::integer[], images);
  perform pg_temp.check_bulk_image('one-image import', result = 'imported' and
    (select count(*) = 1 from public.product_images where product_id = first_id));
  perform pg_temp.check_bulk_image('first image is legacy cover',
    (select image_url = images[1] and not is_published and review_status = 'draft' from public.products where id = first_id));

  select array_agg(prefix || seller::text || '/five-' || i::text || '.png' order by i) into images from generate_series(1,5) i;
  result := public.import_product_csv_row(five_id,
    product || '{"sku":"FIVE","category_type":"Apparel","stock_quantity":0}',
    array['XS','S','M','L','XL','XXL'], array[0,1,2,3,0,0], images);
  perform pg_temp.check_bulk_image('five ordered images', result = 'imported' and
    (select array_agg(image_url order by sort_order) = images and min(sort_order) = 0 and max(sort_order) = 4
      from public.product_images where product_id = five_id));
  perform pg_temp.check_bulk_image('apparel SKU and variants atomic',
    (select sku = 'FIVE' and stock_quantity = 6 and review_status = 'draft' and not is_published from public.products where id = five_id)
    and (select count(*) = 6 from public.product_variants where product_id = five_id));
  result := public.import_product_csv_row(five_id, product, array[]::text[], array[]::integer[], images);
  perform pg_temp.check_bulk_image('exact retry no duplicate product/gallery', result = 'already imported' and
    (select count(*) = 1 from public.products where id = five_id) and
    (select count(*) = 5 from public.product_images where product_id = five_id));

  manual := prefix || seller::text || '/manual.png';
  perform public.save_product_with_images(five_id,
    product || '{"sku":"FIVE","category_type":"Apparel","stock_quantity":0,"is_published":false}',
    array[manual], array['XS','S','M','L','XL','XXL'], array[0,1,2,3,0,0]);
  result := public.import_product_csv_row(five_id, product, array[]::text[], array[]::integer[], images);
  perform pg_temp.check_bulk_image('retry preserves later manual gallery', result = 'already imported' and
    (select image_url = manual from public.products where id = five_id) and
    (select array_agg(image_url) = array[manual] from public.product_images where product_id = five_id));

  rejected := false;
  begin
    perform public.import_product_csv_row(failed_id, product || '{"sku":"ROLLBACK","category_type":"Apparel","stock_quantity":0}',
      array['XS','S','M','L','XL','XXL'], array[0,1,2,3,0,0], array[prefix || other_seller::text || '/foreign.png']);
  exception when others then rejected := true; end;
  perform pg_temp.check_bulk_image('gallery failure rolls back product variants SKU and gallery', rejected and
    not exists (select 1 from public.products where id = failed_id) and
    not exists (select 1 from public.product_variants where product_id = failed_id) and
    not exists (select 1 from public.product_images where product_id = failed_id));
  -- The failed stable ID is eligible for a complete retry, not already imported.
  result := public.import_product_csv_row(failed_id, product || '{"sku":"ROLLBACK"}', array[]::text[], array[]::integer[], images);
  perform pg_temp.check_bulk_image('failed row retry completes gallery', result = 'imported' and
    (select count(*) = 5 from public.product_images where product_id = failed_id));

  rejected := false;
  begin
    perform public.import_product_csv_row(sku_failed_id, product, array[]::text[], array[]::integer[], images);
  exception when unique_violation then rejected := true; end;
  perform pg_temp.check_bulk_image('duplicate SKU leaves no partial product', rejected and
    not exists (select 1 from public.products where id = sku_failed_id));
  rejected := false;
  begin
    perform public.import_product_csv_row(variant_failed_id, product || '{"sku":"BADSIZE","category_type":"Apparel"}',
      array['XS','S','M','L','XL','XXL'], array[0,1,-1,3,0,0], images);
  exception when others then rejected := true; end;
  perform pg_temp.check_bulk_image('variant failure leaves no product or gallery', rejected and
    not exists (select 1 from public.products where id = variant_failed_id) and
    not exists (select 1 from public.product_images where product_id = variant_failed_id));

  result := public.import_product_csv_row(legacy_id, product || '{"sku":"LEGACY"}', array[]::text[], array[]::integer[]);
  perform pg_temp.check_bulk_image('old four-argument RPC remains compatible', result = 'imported' and
    (select image_url is null and not is_published and review_status = 'draft' from public.products where id = legacy_id));
end $$;
reset role;
select jsonb_agg(jsonb_build_object('check_name',check_name,'passed',passed)) as checks from bulk_image_checks;
rollback;
