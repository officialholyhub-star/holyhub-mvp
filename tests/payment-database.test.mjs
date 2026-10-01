// Optional real-Postgres regression suite. Run with
// HOLYHUB_PAYMENT_TEST_CONTAINER=holyhub-webhook-postgres node --test tests/*.test.mjs
// against a fresh disposable local postgres:17 container. The minimal payment
// schema is bootstrapped automatically. This runner never connects remotely.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const container = process.env.HOLYHUB_PAYMENT_TEST_CONTAINER;
if (container) assert.equal(container, 'holyhub-webhook-postgres', 'Use only the dedicated disposable local container');
const fixtureSql = fs.readFileSync('supabase/tests/payment_fixture.sql', 'utf8');
const regressionSql = fs.readFileSync('supabase/tests/payment_order_integrity.sql', 'utf8');
function query(sql, onOutput = () => {}) {
  const child = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-Atq']);
  let output = ''; let errors = '';
  child.stdout.on('data', chunk => { output += chunk; onOutput(output); });
  child.stderr.on('data', chunk => { errors += chunk; });
  const result = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(errors || `psql exited ${code}`)));
  });
  child.stdin.end(sql);
  return result;
}
// Mirror the Supabase auth boundary locally; live TEST checks use its real auth
// schema and all applied migrations. Never bootstrap a remote project here.
if (container && !(await query("select to_regprocedure('public.process_checkout_payment(text,text,text,integer,text,text,jsonb)');"))) {
  const authSql = `
    create role anon nologin; create role authenticated nologin;
    create role service_role nologin bypassrls; create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid $$;
    create function auth.role() returns text language sql stable as $$
      select current_setting('request.jwt.claims', true)::jsonb->>'role' $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on all functions in schema auth to anon, authenticated, service_role;`;
  const migrations = [
    '001_stage1_foundation', '003_stage3_marketplace', '004_stage4_checkout',
    '005_stage5_shipping_orders', '008_product_review_workflow', '009_product_review_status_guard',
    '014_product_review_actor_guard', '015_checkout_seller_delivery_and_moderation_grants',
    '016_apparel_product_variants', '017_product_review_edit_snapshots',
    '018_carrier_neutral_fulfilment', '019_order_delivery_address', '023_webhook_order_integrity',
  ].map(name => fs.readFileSync(`supabase/migrations/${name}.sql`, 'utf8')).join('\n');
  await query(`begin; ${authSql} ${migrations} commit;`);
}
const claims = `do $$ begin perform set_config('request.jwt.claims', '{"role":"service_role"}', true); end $$;`;
const pay = f => `public.process_checkout_payment('${f.stripe}', 'paid', 'paid', 7200, 'gbp', 'pi_local_regression', '{}')`;
const lastJson = output => JSON.parse(output.split('\n').filter(line => line.startsWith('{') || line.startsWith('[')).at(-1));
async function fixture(base = 9, size = 7) {
  return lastJson(await query(`begin; ${claims} ${fixtureSql}
    select pg_temp.payment_fixture(${base}, ${size}); commit;`));
}
async function overlappingFixture(f) {
  return lastJson(await query(`begin; ${claims} ${fixtureSql}
    do $$ declare new_checkout_id uuid := gen_random_uuid(); begin
      insert into public.checkout_sessions(id,user_id,stripe_checkout_session_id,amount_total,product_subtotal,delivery_total,holyhub_commission,seller_amount_total)
      select new_checkout_id,user_id,'cs_test_regression_' || new_checkout_id::text,amount_total,product_subtotal,delivery_total,holyhub_commission,seller_amount_total
      from public.checkout_sessions where id='${f.checkout}';
      insert into public.checkout_session_items(checkout_session_id,product_id,lister_user_id,product_name,unit_amount,quantity,line_total,variant_id,variant_size)
      select new_checkout_id,product_id,lister_user_id,product_name,unit_amount,quantity,line_total,variant_id,variant_size
      from public.checkout_session_items where checkout_session_id='${f.checkout}';
      insert into public.checkout_session_sellers(checkout_session_id,lister_user_id,seller_business_name,delivery_total)
      select new_checkout_id,lister_user_id,seller_business_name,delivery_total from public.checkout_session_sellers where checkout_session_id='${f.checkout}';
      perform set_config('holyhub.new_checkout', new_checkout_id::text, true);
    end $$;
    select jsonb_build_object('checkout',current_setting('holyhub.new_checkout'),'stripe','cs_test_regression_' || current_setting('holyhub.new_checkout'));
    commit;`));
}
async function state(f) {
  return lastJson(await query(`select jsonb_build_object(
    'orders',(select count(*) from public.orders where checkout_session_id='${f.checkout}'),
    'items',(select count(*) from public.order_items where order_id in (select id from public.orders where checkout_session_id='${f.checkout}')),
    'sellers',(select count(*) from public.seller_orders where order_id in (select id from public.orders where checkout_session_id='${f.checkout}')),
    'base',(select stock_quantity from public.products where id='${f.base}'),
    'selected',(select stock_quantity from public.product_variants where id='${f.selected}'),
    'other',(select stock_quantity from public.product_variants where id='${f.other}'),
    'status',(select status from public.checkout_sessions where id='${f.checkout}'));`));
}
test('real Postgres rolled-back payment integrity checks', { skip: !container }, async t => {
  const results = lastJson(await query(`begin; ${fixtureSql} ${regressionSql} rollback;`));
  assert.equal(results.length, 15);
  for (const result of results) await t.test(result.check_name, () => assert.equal(result.passed, true));
});
test('concurrent duplicate connections contend on checkout lock and commit exactly one logical order', { skip: !container }, async () => {
  const f = await fixture();
  let releaseStarted;
  const started = new Promise(resolve => { releaseStarted = resolve; });
  const first = query(`begin; ${claims} set local role service_role;
    select jsonb_build_object('order',${pay(f)}); select pg_sleep(2); commit;`, output => {
    if (output.includes('"order"')) releaseStarted();
  });
  await Promise.race([started, first.then(() => { throw new Error('Missing first transaction output'); })]);
  const second = query(`begin; ${claims} set local role service_role;
    set local application_name='holyhub_payment_duplicate'; select jsonb_build_object('order',${pay(f)}); commit;`);
  let locks = '0';
  for (let attempt = 0; attempt < 15 && locks !== '1'; attempt++) {
    locks = await query(`select count(*) from pg_stat_activity where application_name='holyhub_payment_duplicate' and wait_event_type='Lock';`);
    if (locks !== '1') await new Promise(resolve => setTimeout(resolve, 40));
  }
  assert.equal(locks, '1', 'Second connection must actually wait on the database lock');
  const [a, b] = await Promise.all([first, second]);
  assert.equal(lastJson(a).order, lastJson(b).order);
  assert.deepEqual(await state(f), { orders: 1, items: 2, sellers: 2, base: 7, selected: 4, other: 5, status: 'paid' });
});
test('competing paid checkouts cannot oversell or leave a partial multi-seller order', { skip: !container }, async () => {
  const f = await fixture(2, 3);
  const other = await overlappingFixture(f);
  const results = await Promise.allSettled([f, other].map(value => query(`begin; ${claims} set local role service_role; select ${pay(value)}; commit;`)));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
  const a = await state(f); const b = await state({ ...f, ...other });
  assert.equal(a.orders + b.orders, 1); assert.equal(a.items + b.items, 2); assert.equal(a.sellers + b.sellers, 2);
  assert.equal(a.base, 0); assert.equal(a.selected, 0); assert.equal(a.other, 5);
  assert.deepEqual([a.status, b.status].sort(), ['paid', 'pending']);
});
test('concurrent success and late failure preserve paid state and a complete order', { skip: !container }, async () => {
  const f = await fixture();
  await Promise.all([
    query(`begin; ${claims} set local role service_role; select ${pay(f)}; commit;`),
    query(`begin; ${claims} set local role service_role;
      select public.process_checkout_payment('${f.stripe}','failed','unpaid',null,null,null,'{}'); commit;`),
  ]);
  assert.deepEqual(await state(f), { orders: 1, items: 2, sellers: 2, base: 7, selected: 4, other: 5, status: 'paid' });
});
