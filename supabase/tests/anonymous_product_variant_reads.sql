-- Run as postgres against TEST after migration 022. Every fixture is rolled back.
-- Uses two existing non-admin customer profiles; never changes persistent users.
begin;
create temporary table variant_test_context (label text primary key, id uuid not null);
insert into variant_test_context
select 'lister_a', user_id from public.user_roles r
where role = 'customer' and not exists (
  select 1 from public.user_roles other where other.user_id = r.user_id and other.role in ('admin', 'lister')
) order by user_id limit 1;
insert into variant_test_context
select 'lister_b', user_id from public.user_roles r
where role = 'customer' and user_id <> (select id from variant_test_context where label = 'lister_a')
and not exists (
  select 1 from public.user_roles other where other.user_id = r.user_id and other.role in ('admin', 'lister')
) order by user_id limit 1;
insert into variant_test_context
select 'admin', user_id from public.user_roles where role = 'admin' order by user_id limit 1;
do $$ begin
  assert (select count(*) = 3 from variant_test_context), 'Requires two non-admin customers and an admin';
end $$;
insert into public.user_roles(user_id, role)
select id, 'lister' from variant_test_context where label in ('lister_a', 'lister_b');
insert into public.lister_storefronts(user_id, business_name, description, category_type)
select id, 'Variant policy test', 'Rolled back policy fixture', 'Apparel'
from variant_test_context where label in ('lister_a', 'lister_b');
insert into variant_test_context
select label, gen_random_uuid() from unnest(array[
  'approved', 'pending', 'rejected', 'draft', 'approved_unpublished', 'foreign_draft', 'foreign_public'
]) label;
insert into public.products(id, lister_user_id, name, description, category_type, price, is_published)
select id,
  (select id from variant_test_context where label = case when fixture.label like 'foreign_%' then 'lister_b' else 'lister_a' end),
  label, 'Rolled back variant policy fixture', 'Apparel', 10,
  label not in ('draft', 'foreign_draft')
from variant_test_context fixture where label not in ('lister_a', 'lister_b', 'admin');
-- Follow real moderation transitions; do not disable review triggers.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
update public.products set review_status = 'approved'
where id in (select id from variant_test_context where label in ('approved', 'approved_unpublished', 'foreign_public'));
update public.products set review_status = 'rejected'
where id = (select id from variant_test_context where label = 'rejected');
update public.products set is_published = false
where id = (select id from variant_test_context where label = 'approved_unpublished');
insert into public.product_variants(product_id, size, stock_quantity)
select id, 'M', 7 from variant_test_context where label not in ('lister_a', 'lister_b', 'admin');
create temporary table variant_test_results (check_name text, passed boolean);
grant select on variant_test_context to anon, authenticated;
grant insert on variant_test_results to anon, authenticated;
do $$ begin
  assert not has_function_privilege('anon', 'private.has_role(public.app_role)', 'EXECUTE'), 'Anon helper access widened';
end $$;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  assert (select count(*) = 2 from public.product_variants where product_id in (select id from variant_test_context)), 'Anon must see only approved published variants';
  assert (select count(*) = 1 from public.product_variants where product_id = (select id from variant_test_context where label = 'approved')), 'Approved Apparel variant missing';
  assert not exists (select 1 from public.product_variants where product_id in (select id from variant_test_context where label in ('pending', 'rejected', 'draft', 'approved_unpublished', 'foreign_draft'))), 'Anon private variant leak';
  assert not has_schema_privilege('anon', 'private', 'USAGE'), 'Anon private schema access widened';
end $$;
insert into variant_test_results values
  ('anon approved + published Apparel visible', true),
  ('anon pending/rejected/draft/unpublished variants hidden', true),
  ('anon private schema/helper grants unchanged', true);
reset role;

select set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'sub', (select id from variant_test_context where label = 'lister_a'))::text, true);
set local role authenticated;
do $$ declare affected integer; denied boolean; begin
  assert private.has_role('lister') and not private.has_role('admin'), 'Fixture must be a normal lister';
  assert (select count(*) = 6 from public.product_variants where product_id in (select id from variant_test_context)), 'Lister must see own variants plus public foreign variants';
  assert not exists (select 1 from public.product_variants where product_id = (select id from variant_test_context where label = 'foreign_draft')), 'Foreign private inventory leaked';
  update public.product_variants set stock_quantity = 8 where product_id = (select id from variant_test_context where label = 'draft');
  get diagnostics affected = row_count;
  assert affected = 1, 'Own update denied';
  insert into public.product_variants(product_id, size, stock_quantity)
  values ((select id from variant_test_context where label = 'draft'), 'L', 3);
  delete from public.product_variants where product_id = (select id from variant_test_context where label = 'draft') and size = 'L';
  get diagnostics affected = row_count;
  assert affected = 1, 'Own delete denied';
  update public.product_variants set stock_quantity = 999 where product_id in (select id from variant_test_context where label like 'foreign_%');
  get diagnostics affected = row_count;
  assert affected = 0, 'Foreign update allowed';
  delete from public.product_variants where product_id in (select id from variant_test_context where label like 'foreign_%');
  get diagnostics affected = row_count;
  assert affected = 0, 'Foreign delete allowed';
  denied := false;
  begin
    insert into public.product_variants(product_id, size, stock_quantity)
    values ((select id from variant_test_context where label = 'foreign_public'), 'L', 1);
  exception when insufficient_privilege then denied := true; end;
  assert denied, 'Foreign insert allowed';
  denied := false;
  begin
    update public.product_variants set product_id = (select id from variant_test_context where label = 'foreign_public')
    where product_id = (select id from variant_test_context where label = 'draft');
  exception when insufficient_privilege then denied := true; end;
  assert denied, 'Variant ownership reassignment allowed';
  denied := false;
  begin
    insert into public.user_roles(user_id, role)
    values ((select id from variant_test_context where label = 'lister_a'), 'admin');
  exception when insufficient_privilege then denied := true; end;
  assert denied and not private.has_role('admin'), 'Lister escalated to admin';
end $$;
insert into variant_test_results values
  ('normal lister own read/insert/update/delete work', true),
  ('foreign private reads and all foreign writes blocked', true),
  ('ownership reassignment blocked', true),
  ('normal lister cannot become admin', true);
reset role;

select set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'sub', (select id from variant_test_context where label = 'admin'))::text, true);
set local role authenticated;
do $$ begin
  assert private.has_role('admin'), 'Admin helper failed';
  assert (select count(*) = 7 from public.product_variants where product_id in (select id from variant_test_context)), 'Admin cannot read all variant states';
end $$;
insert into variant_test_results values ('admin can read all variant states', true);
reset role;
select jsonb_agg(to_jsonb(result) order by check_name) as verification from variant_test_results result;
rollback;
