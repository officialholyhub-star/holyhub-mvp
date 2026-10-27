import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

// Explicit opt-in, always a brand-new network-isolated disposable database.
// No URL, env-file loading, shared stage access, or existing container reuse.
const enabled = process.env.HOLYHUB_C11_LOCAL_TEST === '1';
const container = 'holyhub-c11-regression';
let created = false;
let historicalMigrationSnapshot;
let c12Enabled = false;
async function command(args, input) {
  return await new Promise((resolve, reject) => {
    const child = spawn('docker', args); let out = ''; let err = '';
    child.stdout.on('data', x => out += x); child.stderr.on('data', x => err += x);
    child.on('error', reject); child.on('close', code => code ? reject(new Error(err || out)) : resolve(out.trim()));
    child.stdin.end(input);
  });
}
const q = sql => command(['exec', '-i', container, 'psql', '-U', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-Atq'], sql);
const claims = `select set_config('request.jwt.claims','{"role":"service_role"}',true);`;
const run = sql => q(`begin; ${claims} ${sql}; commit;`);
const json = output => JSON.parse(output.split('\n').filter(x => x.startsWith('{') || x.startsWith('[')).at(-1));
const scalar = async sql => (await run(sql)).split('\n').at(-1);
const check = (name, fn) => test(name, { skip: !enabled }, fn);
let fixtureSource = fs.readFileSync('supabase/tests/payment_fixture.sql', 'utf8');
fixtureSource = fixtureSource.replace('  insert into public.checkout_sessions', `
  update public.lister_storefronts set dispatch_window='1-2-working-days' where user_id in (seller_a,seller_b);
  insert into public.seller_legal_profiles(user_id,legal_name,entity_type,address_line1,city,postcode,country,contact_email,verification_status,verified_at)
    select x,'Synthetic seller','sole_trader','1 Test Road','London','SW1A 1AA','GB','synthetic@example.invalid','verified',now() from unnest(array[seller_a,seller_b]) x;
  insert into public.checkout_sessions`);
fixtureSource = fixtureSource.replace('seller_business_name, delivery_total)\n  values', 'seller_business_name, delivery_total,seller_identity_profile_updated_at)\n  values')
  .replace("'Payment fixture A', 200)", "'Payment fixture A', 200, (select updated_at from public.seller_legal_profiles where user_id=seller_a))")
  .replace("'Payment fixture B', 500)", "'Payment fixture B', 500, (select updated_at from public.seller_legal_profiles where user_id=seller_b))");
async function fixture({ credit = false, fee = true, zero = false } = {}) {
  let source = zero ? fixtureSource.replace('7200, 6500, 700, 325, 6175', '5000, 4500, 500, 225, 4275')
    .replace("'Book', 1000, 2, 2000", "'Book', 0, 2, 0")
    .replace("'Payment fixture A', 200,", "'Payment fixture A', 0,") : credit ? fixtureSource.replace('7200, 6500, 700, 325, 6175', '6200, 5500, 700, 275, 5225')
    .replace("'Book', 1000, 2, 2000", "'Book', 500, 2, 1000") : fixtureSource;
  if (c12Enabled) source = source.replace('seller_amount_total)\n  values (checkout_id, buyer, stripe_id,', 'seller_amount_total,delivery_address)\n  values (checkout_id, buyer, stripe_id,')
    .replace(/(values \(checkout_id, buyer, stripe_id,[^;]+)\);/, `$1,'{"delivery_recipient_name":"HolyHub Recipient","delivery_address_line1":"10 Trusted Road","delivery_address_line2":null,"delivery_city":"London","delivery_postcode":"SW1A 1AA","delivery_country":"GB"}'::jsonb);`);
  const total = zero ? 5000 : credit ? 6200 : 7200;
  const providerFee = zero ? 0 : credit ? 191 : 120;
  return json(await run(`${source}
    do $$ declare f jsonb; o uuid; begin
      f:=pg_temp.payment_fixture();
      o:=public.process_checkout_payment(f->>'stripe','paid','paid',${total},'gbp','pi_'||(f->>'checkout'),'{"delivery_address_line1":"1 Test Road","delivery_city":"London","delivery_postcode":"SW1A 1AA","delivery_country":"GB"}');
      perform public.sync_payment_order(o);
      ${fee ? `perform public.match_payment_charge(o,'pi_'||(f->>'checkout'),'ch_'||(f->>'checkout'),${total},${providerFee});` : ''}
      insert into public.seller_payment_accounts(seller_user_id,stripe_account_id,verified_by)
        values((f->>'seller_a')::uuid,'acct_'||(f->>'seller_a'),(f->>'buyer')::uuid),
          ((f->>'seller_b')::uuid,'acct_'||(f->>'seller_b'),(f->>'buyer')::uuid);
      f:=f||jsonb_build_object('order',o,
        'a',(select id from public.seller_orders where order_id=o and seller_user_id=(f->>'seller_a')::uuid),
        'b',(select id from public.seller_orders where order_id=o and seller_user_id=(f->>'seller_b')::uuid),
        'item_a',(select id from public.order_items where order_id=o and seller_user_id=(f->>'seller_a')::uuid),
        'item_b',(select id from public.order_items where order_id=o and seller_user_id=(f->>'seller_b')::uuid));
      perform set_config('c11.fixture',f::text,true);
    end $$; select current_setting('c11.fixture');`));
}
async function delivered(id) { await run(`update public.seller_orders set fulfilment_status='delivered',delivered_at=now() where id='${id}';`); }
async function reserve(id) { return scalar(`select public.reserve_seller_transfer('${id}');`); }
async function operation(id) { return json(await run(`select row_to_json(o) from public.payment_operations o where id='${id}';`)); }
async function settle(id, status = 'succeeded', provider = null) {
  const op = await operation(id);
  const stripe = provider ?? `${op.kind === 'refund' ? 're' : op.kind === 'transfer' ? 'tr' : 'trr'}_${id}`;
  await run(`select public.settle_payment_operation('${id}',null,'${status}',${status==='failed' ? 'null' : `'${stripe}'`},${op.amount},${status==='failed' ? "'seller_balance_insufficient'" : 'null'});`);
}
async function refund(f, { seller = 'a', amount = 1000, delivery = 0, restore = 0, key = crypto.randomUUID(), responsible = true } = {}) {
  const lines = amount ? [{ item_id: f[`item_${seller}`], amount, restore_quantity: restore }] : [];
  return scalar(`select public.request_payment_refund('${f[seller]}','${key}','${JSON.stringify(lines)}',${delivery},'Verified synthetic case',${responsible});`);
}
async function debt(id) { return json(await run(`select row_to_json(d) from public.seller_debts d where refund_operation_id='${id}';`)); }
async function reversal(id) { return scalar(`select id from public.payment_operations where kind='reversal' and details->>'refund_operation_id'='${id}';`); }
const bootstrapSql = `create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claims',true)::jsonb->>'role' $$;
    grant usage on schema auth to anon,authenticated,service_role;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
    alter default privileges in schema public grant all on tables to service_role;
    alter default privileges in schema public grant all on sequences to service_role;`;
before(async () => {
  if (!enabled) return;
  // Docker refuses if this name already exists: never delete somebody's DB.
  await command(['run', '--detach', '--name', container, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17']);
  created = true;
  for (let i = 0; ; i++) {
    try { await command(['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); break; }
    catch (error) { if (i === 50) throw error; await new Promise(r => setTimeout(r, 100)); }
  }
  await q(bootstrapSql);
  for (const name of fs.readdirSync('supabase/migrations').filter(x => x.endsWith('.sql')).sort()) {
    if(name.includes('c12_delivery_territory')) continue; // Applied after the existing C9/C11/A138 regression phases.
    if(name.includes('a138_')) continue; // A138 is applied after the frozen A113 regressions below.
    if(name.includes('a113_')) {
      const f=await fixture(); const id=await refund(f,{amount:600,responsible:false}); await settle(id);
      const tables=['payment_policy','seller_payment_accounts','platform_payments','seller_allocations','payment_operations',
        'refund_lines','seller_debts','seller_recovery_events','payment_webhook_events','lister_terms_acceptances'];
      const snapshot=async()=>json(await q(`select json_build_object(${tables.map(t=>`'${t}',(select json_build_object('count',count(*),'hash',md5(coalesce(string_agg((to_jsonb(t)-'processing_fee_credit_policy_version')::text,',' order by (to_jsonb(t)-'processing_fee_credit_policy_version')::text),''))) from public.${t} t)`).join(',')})`));
      const before=await snapshot();
      await q(fs.readFileSync(`supabase/migrations/${name}`,'utf8'));
      historicalMigrationSnapshot={before,after:await snapshot(),id};
      assert.equal(await q('select count(*) from public.processing_fee_credits'), '0');
      assert.equal(await q('select count(*) from public.payment_operations where processing_fee_credit_policy_version<>0'), '0');
    } else await q(`begin; ${fs.readFileSync(`supabase/migrations/${name}`, 'utf8')} commit;`);
  }
});
after(async () => { if (created) await command(['rm', '-f', container]); });

check('multi-seller payment allocations reconcile; 5% product only excludes delivery', async () => {
  const f = await fixture();
  const sums = json(await run(`select jsonb_build_object('allocations',count(*),'product',sum(product_value),'delivery',sum(delivery_value),'commission',sum(commission),'fees',sum(processing_fee)) from public.seller_allocations where order_id='${f.order}';`));
  assert.deepEqual(sums, { allocations: 2, product: 6500, delivery: 700, commission: 325, fees: 120 });
});
check('Seller A delivered releases only A; B remains held until its own delivery', async () => {
  const f = await fixture();
  await assert.rejects(reserve(f.a)); await delivered(f.a);
  const a = await reserve(f.a); assert.equal((await operation(a)).amount, 2063);
  await assert.rejects(reserve(f.b)); await delivered(f.b);
  assert.equal((await operation(await reserve(f.b))).amount, 4692);
});
check('dispatch alone never releases proceeds', async () => {
  const f = await fixture(); await run(`update public.seller_orders set fulfilment_status='dispatched',dispatched_at=now() where id='${f.a}';`);
  await assert.rejects(reserve(f.a));
});
check('partial item pre-transfer refund reduces only affected held seller allocation', async () => {
  const f = await fixture(); const r = await refund(f); await settle(r); await delivered(f.a);
  const transfer = await operation(await reserve(f.a)); assert.equal(transfer.amount, 1113);
  const a = json(await run(`select row_to_json(a) from public.seller_allocations a where seller_order_id='${f.a}';`));
  assert.equal(a.commission_credit, 50); assert.equal(a.refunded_product, 1000);
  assert.equal(await scalar(`select refunded_product from public.seller_allocations where seller_order_id='${f.b}';`), '0');
});
check('delivery-only refund creates zero commission credit', async () => {
  const f = await fixture(); const r = await refund(f, { amount: 0, delivery: 100 }); await settle(r);
  assert.equal((await operation(r)).details.commission_credit, 0);
});
check('full seller refund creates only verified fee shortfall; no transfer needed', async () => {
  const f = await fixture(); const r = await refund(f, { amount: 2000, delivery: 200 }); await settle(r);
  const d = await debt(r); assert.equal(d.original_amount, 37); assert.equal(d.verified_shortfall, 37); assert.equal(d.recovery_status, 'outstanding');
});
check('post-transfer customer refund precedes reversal and records provider IDs', async () => {
  const f = await fixture(); await delivered(f.a); const t = await reserve(f.a); await settle(t);
  const r = await refund(f); await settle(r); const rev = await reversal(r);
  assert.equal((await operation(r)).status, 'succeeded'); assert.equal((await operation(rev)).amount, 950);
  await settle(rev); const d = await debt(r); assert.equal(d.recovered_amount, 950); assert.equal(d.recovery_status, 'resolved');
});
check('failed reversal and insufficient seller funds retain paid refund and verified HolyHub advance', async () => {
  const f = await fixture(); await delivered(f.a); await settle(await reserve(f.a));
  const r = await refund(f); await settle(r); await settle(await reversal(r), 'failed');
  const d = await debt(r); assert.equal(d.verified_shortfall, 950); assert.equal(d.original_amount-d.recovered_amount, 950);
  assert.equal((await operation(r)).status, 'succeeded');
});
check('partial reversal caps at original transfer; remaining processing shortfall stays debt', async () => {
  const f = await fixture(); await delivered(f.a); await settle(await reserve(f.a));
  const r = await refund(f, { amount: 2000, delivery: 200 }); await settle(r);
  const rev = await reversal(r); assert.equal((await operation(rev)).amount, 2063); await settle(rev);
  const d = await debt(r); assert.equal(d.original_amount, 2100); assert.equal(d.recovered_amount, 2063); assert.equal(d.verified_shortfall, 37);
});
check('duplicate refund key returns same operation; conflicting request is rejected', async () => {
  const f = await fixture(); const key = crypto.randomUUID(); const r = await refund(f, { key });
  assert.equal(await refund(f, { key }), r); await assert.rejects(refund(f, { key, amount: 500 }));
});
check('concurrent transfer release reserves exactly one operation and one recovery', async () => {
  const f = await fixture(); await delivered(f.a);
  const ids = await Promise.all(Array.from({ length: 6 }, () => reserve(f.a)));
  assert.equal(new Set(ids).size, 1);
});
check('concurrent refund requests cannot exceed purchased item or seller amounts', async () => {
  const f = await fixture(); const results = await Promise.allSettled([refund(f, { amount: 1500 }), refund(f, { amount: 1500 })]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
});
check('refund/reversal acknowledgements are idempotent and recovery never doubles', async () => {
  const f = await fixture(); await delivered(f.a); await settle(await reserve(f.a)); const r = await refund(f); await settle(r); await settle(r);
  const rev = await reversal(r); await Promise.all([settle(rev), settle(rev)]);
  const d = await debt(r); assert.equal(d.recovered_amount, 950);
  assert.equal(await scalar(`select count(*) from public.seller_recovery_events where debt_id='${d.id}';`), '1');
});
check('stock restores exactly once for a verified sellable item; failed refund restores nothing', async () => {
  const f = await fixture(); const r = await refund(f, { restore: 1 }); await settle(r); await settle(r);
  assert.equal(await scalar(`select stock_quantity from public.products where id='${f.base}';`), '8');
  const bad = await refund(f, { restore: 1 }); await settle(bad, 'failed');
  assert.equal(await scalar(`select stock_quantity from public.products where id='${f.base}';`), '8');
});
check('faulty returned item does not automatically restore stock', async () => {
  const f = await fixture(); await settle(await refund(f));
  assert.equal(await scalar(`select stock_quantity from public.products where id='${f.base}';`), '7');
});
check('apparel restoration changes the purchased variant and aggregate once', async () => {
  const f = await fixture(); const r = await refund(f, { seller: 'b', amount: 1500, restore: 1 }); await settle(r); await settle(r);
  assert.equal(await scalar(`select stock_quantity from public.product_variants where id='${f.selected}';`), '5');
  assert.equal(await scalar(`select stock_quantity from public.product_variants where id='${f.other}';`), '5');
  assert.equal(await scalar(`select stock_quantity from public.products where id='${f.apparel}';`), '10');
});
check('cross-seller item refund is rejected', async () => {
  const f = await fixture(); await assert.rejects(scalar(`select public.request_payment_refund('${f.a}','cross-${f.a}','[{"item_id":"${f.item_b}","amount":1000,"restore_quantity":0}]',0,'test',true);`));
});
check('debt survives seller exit and prevents silent deletion', async () => {
  const f = await fixture(); const r = await refund(f, { amount: 2000, delivery: 200 }); await settle(r);
  await run(`update public.profiles set account_status='closed' where id='${f.seller_a}';`);
  assert.equal((await debt(r)).original_amount, 37);
  await assert.rejects(run(`delete from auth.users where id='${f.seller_a}';`));
});
check('pending refunds block transfer and repeated leases cannot duplicate provider creation', async () => {
  const f = await fixture(); const r = await refund(f); await delivered(f.a); await assert.rejects(reserve(f.a));
  assert.ok(json(await run(`select public.claim_payment_operation('${r}');`)).lease_token);
  assert.equal(await scalar(`select public.claim_payment_operation('${r}') is null;`), 't');
  await run(`update public.payment_operations set lease_until=now()-interval '1 minute',first_attempt_at=now()-interval '24 hours' where id='${r}';`);
  assert.equal(await scalar(`select public.claim_payment_operation('${r}') is null;`), 't');
  assert.equal((await operation(r)).status, 'attention');
});
check('direct cancellation bypass is rejected; guarded seller cancellation queues and retries once', async () => {
  const f = await fixture(); await assert.rejects(run(`update public.seller_orders set fulfilment_status='cancelled' where id='${f.a}';`));
  const call = `select set_config('request.jwt.claims','{"role":"authenticated","sub":"${f.seller_a}"}',true); set local role authenticated; select public.cancel_seller_order_with_refund('${f.a}','pending','item_unavailable');`;
  const r = await scalar(call); assert.equal(await scalar(call), r); await settle(r);
  assert.equal(await scalar(`select stock_quantity from public.products where id='${f.base}';`), '9');
  assert.equal(await scalar(`select fulfilment_status from public.seller_orders where id='${f.b}';`), 'pending');
});
check('anonymous/customer cannot invoke financial mutations or read private balances', async () => {
  assert.equal(await scalar(`select has_function_privilege('anon','public.request_payment_refund(uuid,text,jsonb,integer,text,boolean)','EXECUTE');`), 'f');
  assert.equal(await scalar(`select has_table_privilege('authenticated','public.seller_debts','SELECT');`), 'f');
});
check('reconciliation exposes balanced allocation and matching debt recovery ledger', async () => {
  const f = await fixture(); await delivered(f.a); await settle(await reserve(f.a)); const r = await refund(f); await settle(r); await settle(await reversal(r));
  const rec = json(await run(`select row_to_json(r) from public.payment_reconciliation r where order_id='${f.order}';`));
  assert.equal(rec.payment_amount, rec.allocated_amount); assert.equal(rec.customer_refunded_amount, 1000); assert.equal(rec.debt_ledger_mismatches, 0);
});
check('unreviewed draft terms stay inactive and cannot manufacture seller acceptance', async () => {
  const f = await fixture();
  assert.equal(await scalar(`select status from public.lister_terms_versions where version='2026-10-19-c11-prelaunch-v2';`), 'draft');
  assert.equal(await scalar(`select recovery_terms_version is null from public.payment_policy;`), 't');
  await assert.rejects(run(`select set_config('request.jwt.claims','{"role":"authenticated","sub":"${f.seller_a}"}',true); set local role authenticated; select public.accept_current_lister_terms('c11-synthetic-reviewed',repeat('a',64),'lister_portal');`));
});

check('same-seller future recovery requires exact accepted terms and caps/de-duplicates debt; no cross-seller recovery', async () => {
  const f = await fixture(); const r = await refund(f, { amount: 2000, delivery: 200 }); await settle(r);
  // A second purchased portion for the SAME seller, not another seller's funds.
  await run(`insert into public.seller_orders(order_id,seller_user_id,seller_business_name,product_subtotal,delivery_total,total_amount,holyhub_commission,seller_amount,fulfilment_status,delivered_at)
    select order_id,'${f.seller_a}',seller_business_name,product_subtotal,delivery_total,total_amount,holyhub_commission,seller_amount,'delivered',now() from public.seller_orders where id='${f.b}'
    on conflict(order_id,seller_user_id) do nothing;`);
  // Use an independent future order fixture and reassign only its fixture seller
  // before financial snapshots are created, retaining all per-seller boundaries.
  const future = await fixture();
  await run(`update public.seller_orders set seller_user_id='${f.seller_a}' where id='${future.a}';
    update public.seller_allocations set seller_user_id='${f.seller_a}' where seller_order_id='${future.a}';`);
  await delivered(future.a);
  // Without reviewed acceptance even matching-seller future proceeds stay whole.
  const before = await reserve(future.a); assert.equal((await operation(before)).details.recovery_amount, 0);
  await run(`insert into public.lister_terms_versions(version,status,content_sha256,published_path,activated_at)
    values('c11-synthetic-reviewed','active',repeat('a',64),'/lister-terms',now());
    update public.payment_policy set recovery_terms_version='c11-synthetic-reviewed';`);
  const acceptance = `select set_config('request.jwt.claims','{"role":"authenticated","sub":"${f.seller_a}"}',true); set local role authenticated; select public.accept_current_lister_terms('c11-synthetic-reviewed',repeat('a',64),'lister_portal');`;
  assert.equal(await scalar(acceptance), 'c11-synthetic-reviewed'); assert.equal(await scalar(acceptance), 'c11-synthetic-reviewed');
  const next = await fixture();
  await run(`update public.seller_orders set seller_user_id='${f.seller_a}' where id='${next.a}'; update public.seller_allocations set seller_user_id='${f.seller_a}' where seller_order_id='${next.a}';`);
  await delivered(next.a); await delivered(next.b);
  const ids = await Promise.all([reserve(next.a), reserve(next.a)]); assert.equal(ids[0], ids[1]);
  const op = await operation(ids[0]); assert.equal(op.details.recovery_amount, 37); assert.equal(op.amount, 2026);
  assert.equal((await operation(await reserve(next.b))).details.recovery_amount, 0);
  await settle(op.id); await settle(op.id);
  assert.equal((await debt(r)).recovered_amount, 37); assert.equal((await debt(r)).recovery_status, 'resolved');
  // Restore the test policy to fail closed for subsequent tests.
  await run(`update public.payment_policy set recovery_terms_version=null; update public.lister_terms_versions set status='retired',retired_at=now() where version='c11-synthetic-reviewed';`);
});

check('queued but unattempted transfer is reduced for a pre-transfer refund', async () => {
  const f = await fixture(); await delivered(f.a); const t = await reserve(f.a);
  const r = await refund(f); assert.equal((await operation(t)).amount, 1113);
  assert.equal(await scalar(`select public.claim_payment_operation('${t}') is null;`), 't');
  await settle(r);
  const claimed = json(await run(`select public.claim_payment_operation('${t}');`));
  assert.equal(claimed.amount, 1113);
  assert.equal(await scalar(`select count(*) from public.seller_debts where refund_operation_id='${r}';`), '0');
  assert.equal(await scalar(`select count(*) from public.payment_operations where kind='reversal' and allocation_id='${claimed.allocation_id}';`), '0');
});
check('inventory failure cannot hide a successful customer refund or restore deleted variants into base stock', async () => {
  const f = await fixture(); const r = await refund(f, { seller: 'b', amount: 1500, restore: 1 });
  await run(`delete from public.product_variants where id='${f.selected}';`);
  await settle(r); await settle(r);
  assert.equal((await operation(r)).status, 'succeeded');
  assert.equal(await scalar(`select restoration_error from public.refund_lines where operation_id='${r}';`), 'inventory_reconciliation_required');
  assert.equal(await scalar(`select stock_quantity from public.products where id='${f.apparel}';`), '9');
});
check('delivered correction cannot reopen a reserved transfer for duplicate release', async () => {
  const f = await fixture(); await delivered(f.a); const t = await reserve(f.a);
  await assert.rejects(run(`update public.seller_orders set fulfilment_status='dispatched',delivered_at=null where id='${f.a}';`));
  assert.equal(await reserve(f.a), t);
});
check('externally adjusted seller is held across future portions despite charge refresh', async () => {
  const f = await fixture(); await run(`update public.platform_payments set reconciliation_hold=true where order_id='${f.order}';`);
  await run(`select public.match_payment_charge('${f.order}','pi_${f.checkout}','ch_${f.checkout}',7200,120);`);
  assert.equal(await scalar(`select reconciliation_status from public.platform_payments where order_id='${f.order}';`), 'attention');
  await delivered(f.a); await assert.rejects(reserve(f.a));
});

check('full replay also succeeds in mapped stage timestamp order with identical function definitions', async () => {
  const db = 'c11_stage_order';
  const query = sql => command(['exec', '-i', container, 'psql', '-U', 'postgres', '-d', db, '-X', '-v', 'ON_ERROR_STOP=1', '-Atq'], sql);
  await q(`create database ${db};`);
  await query(bootstrapSql.replace(/create role [^;]+;/g, ''));
  const mapped = [
    '025_stripe_fee_payout_breakdown.sql',
    '20261009151400_lister_approval_role_permissions.sql', '026_seller_legal_identity.sql',
    '20261017200000_c6_durable_order_confirmation.sql', '20261017200500_c6_dispatch_visibility_gate.sql',
    '20261017201000_c6_notification_worker_primitives.sql', '20261017204000_c9_lister_terms_acceptance_gate.sql',
    '20261018090000_flexible_dispatch_working_days.sql', '20261018010000_audit_readiness_hardening.sql',
    '20261019105706_c11_guarded_payments.sql',
    '20261020112737_a110_c11_rpc_execute_permissions.sql',
    '20261020195527_a113_holyhub_processing_fee_credits.sql',
    '20261022162816_bind_lister_terms_acceptance.sql',
  ];
  const earlier = fs.readdirSync('supabase/migrations').filter(x => x.endsWith('.sql') && !x.includes('a138_') && !x.includes('c12_delivery_territory') && !mapped.includes(x)).sort();
  for (const name of [...earlier, ...mapped]) await query(`begin; ${fs.readFileSync(`supabase/migrations/${name}`, 'utf8')} commit;`);
  const fingerprint = `select md5(string_agg(pg_get_functiondef(p.oid), E'\n' order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f';`;
  assert.equal(await q(fingerprint), await query(fingerprint));
});
check('financial functions work under actual service_role rather than only owner claims', async () => {
  const f = await fixture();
  const id = await scalar(`set local role service_role; select public.request_payment_refund('${f.a}','role-${f.a}','[{"item_id":"${f.item_a}","amount":1000,"restore_quantity":1}]',0,'Verified role test',true);`);
  await run(`set local role service_role; select public.settle_payment_operation('${id}',null,'succeeded','re_${id}',1000,null);`);
  assert.equal((await operation(id)).status, 'succeeded');
});

check('penny-sized multi-seller basket uses sum of independently rounded product commissions', async () => {
  const result = json(await run(`${fixtureSource}
    do $$ declare f jsonb; o uuid; begin
      f:=pg_temp.payment_fixture();
      update public.checkout_session_items set unit_amount=5,line_total=quantity*5 where checkout_session_id=(f->>'checkout')::uuid;
      update public.checkout_sessions set product_subtotal=25,amount_total=725,holyhub_commission=2,seller_amount_total=23 where id=(f->>'checkout')::uuid;
      o:=public.process_checkout_payment(f->>'stripe','paid','paid',725,'gbp','pi_'||(f->>'checkout'),'{}');
      perform set_config('c11.rounding_order',o::text,true);
    end $$;
    select jsonb_build_object('platform',(select holyhub_commission from public.orders where id=current_setting('c11.rounding_order')::uuid),
      'allocated',(select sum(commission) from public.seller_allocations where order_id=current_setting('c11.rounding_order')::uuid));`));
  assert.deepEqual(result, { platform: 2, allocated: 2 });
});
check('zero-value seller portion cancellation restores applicable free-item stock once without customer money movement', async () => {
  const f = json(await run(`${fixtureSource}
    do $$ declare f jsonb; o uuid; begin
      f:=pg_temp.payment_fixture();
      update public.checkout_session_items set unit_amount=0,line_total=0 where checkout_session_id=(f->>'checkout')::uuid and lister_user_id=(f->>'seller_a')::uuid;
      update public.checkout_session_sellers set delivery_total=0 where checkout_session_id=(f->>'checkout')::uuid and lister_user_id=(f->>'seller_a')::uuid;
      update public.checkout_sessions set product_subtotal=4500,delivery_total=500,amount_total=5000,holyhub_commission=225,seller_amount_total=4275 where id=(f->>'checkout')::uuid;
      o:=public.process_checkout_payment(f->>'stripe','paid','paid',5000,'gbp','pi_'||(f->>'checkout'),'{}');
      f:=f||jsonb_build_object('a',(select id from public.seller_orders where order_id=o and seller_user_id=(f->>'seller_a')::uuid));
      perform set_config('c11.free_fixture',f::text,true);
    end $$; select current_setting('c11.free_fixture');`));
  const r = await scalar(`select set_config('request.jwt.claims','{"role":"authenticated","sub":"${f.seller_a}"}',true); set local role authenticated; select public.cancel_seller_order_with_refund('${f.a}','pending','unable_to_fulfil');`);
  assert.equal((await operation(r)).amount, 0);
  await run(`select public.settle_payment_operation('${r}',null,'succeeded',null,0,null);`);
  await run(`select public.settle_payment_operation('${r}',null,'succeeded',null,0,null);`);
  assert.equal(await scalar(`select stock_quantity from public.products where id='${f.base}';`), '9');
});
check('legacy in-flight basket rounding still records paid order and holds discrepant transfers for review', async () => {
  const f = json(await run(`${fixtureSource}
    do $$ declare f jsonb; o uuid; begin
      f:=pg_temp.payment_fixture();
      update public.checkout_session_items set unit_amount=5,line_total=quantity*5 where checkout_session_id=(f->>'checkout')::uuid;
      update public.checkout_sessions set product_subtotal=25,amount_total=725,holyhub_commission=1,seller_amount_total=24 where id=(f->>'checkout')::uuid;
      o:=public.process_checkout_payment(f->>'stripe','paid','paid',725,'gbp','pi_'||(f->>'checkout'),'{}');
      perform public.match_payment_charge(o,'pi_'||(f->>'checkout'),'ch_'||(f->>'checkout'),725,0);
      f:=f||jsonb_build_object('order',o,'a',(select id from public.seller_orders where order_id=o and seller_user_id=(f->>'seller_a')::uuid));
      perform set_config('c11.legacy_fixture',f::text,true);
    end $$; select current_setting('c11.legacy_fixture');`));
  assert.equal(await scalar(`select order_status from public.orders where id='${f.order}';`), 'paid');
  assert.equal(await scalar(`select reconciliation_status from public.platform_payments where order_id='${f.order}';`), 'attention');
  assert.equal(await scalar(`select holyhub_commission from public.orders where id='${f.order}';`), '1');
  await delivered(f.a); await assert.rejects(reserve(f.a));
});
check('transfer claim re-reads refund balance after waiting on the seller lock', async () => {
  const f = await fixture(); await delivered(f.a); const t = await reserve(f.a);
  const first = run(`set local application_name='c11_refund_race';
    select private.payment_seller_lock('${f.seller_a}'); select pg_sleep(2);
    do $$ declare r uuid; begin
      r:=public.request_payment_refund('${f.a}','race-${f.a}','[{"item_id":"${f.item_a}","amount":1000,"restore_quantity":0}]',0,'Verified race case',true);
      perform public.settle_payment_operation(r,null,'succeeded','re_race_'||r::text,1000,null);
    end $$;`);
  let observed = false;
  for (let i = 0; i < 30; i++) {
    if (await scalar(`select count(*) from pg_stat_activity where application_name='c11_refund_race' and wait_event='PgSleep';`) === '1') { observed = true; break; }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.equal(observed, true, 'First connection must hold the seller lock before claim starts');
  const claim = run(`set local application_name='c11_transfer_claim'; select public.claim_payment_operation('${t}');`);
  let contended = false;
  for (let i = 0; i < 20; i++) {
    if (await scalar(`select count(*) from pg_stat_activity where application_name='c11_transfer_claim' and wait_event_type='Lock';`) === '1') { contended = true; break; }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.equal(contended, true, 'Claim must actually wait on the other transaction');
  await first; const claimed = json(await claim); assert.equal(claimed.amount, 1113);
});

async function creditRow(id) {
  return json(await run(`select row_to_json(c) from public.processing_fee_credits c where refund_operation_id='${id}';`));
}
async function recognize(id) { return scalar(`select public.reserve_processing_fee_credit('${id}');`); }
async function creditSnapshot(f) {
  return json(await run(`select jsonb_build_object('allocation',(select row_to_json(a) from public.seller_allocations a where seller_order_id='${f.b}'),
    'credits',(select count(*) from public.processing_fee_credits c join public.seller_allocations a on a.id=c.allocation_id where a.seller_order_id='${f.b}'),
    'debt',(select count(*) from public.seller_debts where seller_user_id='${f.seller_b}'))`));
}
check('A113 normal sale retains seller fee and has no processing-fee credit', async () => {
  const f = await fixture({ credit: true }); await delivered(f.a); const t = await reserve(f.a);
  assert.equal((await operation(t)).amount, 1113);
  assert.equal(await scalar(`select count(*) from public.processing_fee_credits c join public.seller_allocations a on a.id=c.allocation_id where a.order_id='${f.order}'`), '0');
});
for (const [name, amount, delivery, expected] of [
  ['full', 1000, 200, 37], ['partial product', 600, 0, 19],
  ['delivery only', 0, 200, 6], ['mixed product/delivery', 400, 200, 19],
]) check(`A113 HolyHub ${name} refund recognizes exact credit and preserves Seller B`, async () => {
  const f = await fixture({ credit: true }); const b = await creditSnapshot(f);
  const id = await refund(f, { amount, delivery, responsible: false }); await settle(id);
  const c = await creditRow(id); assert.equal(c.amount, expected); assert.equal(c.status, 'payable');
  assert.equal(c.original_gross, 1200); assert.equal(c.allocated_fee, 37);
  assert.equal((await operation(id)).details.seller_responsibility, 0);
  assert.deepEqual(await creditSnapshot(f), b);
  assert.equal(await scalar(`select count(*) from public.seller_debts where refund_operation_id='${id}'`), '0');
  const view = json(await run(`select row_to_json(v) from public.processing_fee_credit_reconciliation v where refund_operation_id='${id}'`));
  assert.equal(view.original_provider_processing_fee, 191); assert.equal(view.original_seller_allocated_fee, 37);
  assert.equal(view.formula_matches, true); assert.equal(view.within_allocated_fee, true); assert.equal(view.original_fee_allocation_matches, true);
  assert.equal(view.recognized_amount, view.paid_amount + view.outstanding_payable_amount);
});
for (const amount of [500,1000]) check(`A113 seller-responsible ${amount}p refund has no credit or duplicated fee accounting`, async () => {
  const f = await fixture({ credit: true }); const id = await refund(f, { amount, delivery: amount===1000 ? 200 : 0 });
  await settle(id); await recognize(id); await run(`select public.account_payment_refund('${id}')`);
  assert.equal(await scalar(`select count(*) from public.processing_fee_credits where refund_operation_id='${id}'`), '0');
  assert.equal(await scalar(`select processing_fee from public.seller_allocations where seller_order_id='${f.a}'`), '37');
  assert.equal(await scalar(`select count(*) from public.seller_debts where refund_operation_id='${id}'`), amount===1000 ? '1' : '0');
});
check('A113 three £4 refunds produce 12p,13p,12p; arbitrary splits converge without gain', async () => {
  for (const split of [[400,400,400], [600,600], [1,1199], [200,200,800], [1200]]) {
    const f = await fixture({ credit: true }); let productLeft=1000; const increments=[];
    for (const gross of split) {
      const amount=Math.min(productLeft,gross); productLeft-=amount;
      const id=await refund(f,{amount,delivery:gross-amount,responsible:false}); await settle(id);
      increments.push((await creditRow(id)).amount); await recognize(id);
    }
    assert.equal(increments.reduce((a,b)=>a+b,0),37);
    if (split.length===3 && split[0]===400) assert.deepEqual(increments,[12,13,12]);
    assert.equal(await scalar(`select max(credit_total_after) from public.processing_fee_credits c join public.seller_allocations a on a.id=c.allocation_id where a.order_id='${f.order}'`),'37');
    await assert.rejects(refund(f,{amount:1,responsible:false}));
  }
});
check('A113 separate binary seller-only and HolyHub-only refunds include only successful HolyHub gross', async () => {
  const f=await fixture({credit:true}); const seller=await refund(f,{amount:400}); await settle(seller);
  const hh=await refund(f,{amount:600,delivery:200,responsible:false}); await settle(hh);
  const c=await creditRow(hh); assert.equal(c.eligible_gross_after,800); assert.equal(c.amount,25);
});
check('A113 pending then failed refund is never payable', async () => {
  const f=await fixture({credit:true}); const id=await refund(f,{amount:600,responsible:false}); await recognize(id);
  assert.equal((await creditRow(id)).status,'awaiting_evidence');
  await settle(id,'pending'); await recognize(id); assert.equal((await creditRow(id)).amount,0);
  // A failed refund retains the same provider identity.
  await run(`select public.settle_payment_operation('${id}',null,'failed','re_${id}',600,'stripe_refund_failed')`);
  assert.equal((await creditRow(id)).status,'void'); assert.equal((await creditRow(id)).payment_operation_id,null);
});
check('A113 success without fee evidence waits and later recognizes once', async () => {
  const f=await fixture({credit:true,fee:false}); const id=await refund(f,{amount:600,responsible:false}); await settle(id);
  assert.equal((await creditRow(id)).status,'awaiting_evidence');
  await run(`select public.match_payment_charge('${f.order}','pi_${f.checkout}','ch_${f.checkout}',6200,191)`);
  await recognize(id); await recognize(id); assert.equal((await creditRow(id)).amount,19);
  assert.equal(await scalar(`select count(*) from public.processing_fee_credits where refund_operation_id='${id}'`),'1');
});
check('A113 concurrent recognition serializes different successful refunds with delayed fee evidence', async () => {
  const f=await fixture({credit:true,fee:false}); const a=await refund(f,{amount:400,responsible:false}); await settle(a);
  const b=await refund(f,{amount:400,responsible:false}); await settle(b);
  await run(`select public.match_payment_charge('${f.order}','pi_${f.checkout}','ch_${f.checkout}',6200,191)`);
  await Promise.all([recognize(a),recognize(b),recognize(a),recognize(b)]);
  const ca=await creditRow(a),cb=await creditRow(b);
  assert.equal(ca.amount+cb.amount,25); assert.notEqual(ca.recognition_sequence,cb.recognition_sequence);
  assert.equal(await scalar(`select count(*) from public.payment_operations where kind='fee_credit_transfer' and details->>'refund_operation_id' in ('${a}','${b}')`),'2');
});
check('A113 policy version zero is never automatically reimbursed', async () => {
  const f=await fixture({credit:true}); const id=await refund(f,{amount:1000,delivery:200,responsible:false});
  await run(`update public.payment_operations set processing_fee_credit_policy_version=0 where id='${id}'`);
  await settle(id); await recognize(id);
  assert.equal(await scalar(`select count(*) from public.processing_fee_credits where refund_operation_id='${id}'`),'0');
});
check('A113 exact numeric entitlement handles zero gross and large integer operands', async () => {
  assert.equal(await scalar('select private.processing_fee_entitlement(0,37,0)'), '0');
  assert.equal(await scalar('select private.processing_fee_entitlement(2147483647,2147483647,2147483647)'), '2147483647');
});
check('A113 credit claiming, unknown outcome, reconciliation and paid state exclude seller debt', async () => {
  const f=await fixture({credit:true}); const id=await refund(f,{amount:1000,delivery:200,responsible:false}); await settle(id);
  const c=await creditRow(id); const t=c.payment_operation_id;
  const claimed=json(await run(`select public.claim_payment_operation('${t}')`)); assert.equal(claimed.amount,37);
  assert.equal((await creditRow(id)).status,'paying');
  await run(`update public.payment_operations set lease_until=now()-interval '1 second' where id='${t}'`);
  assert.equal(await scalar(`select public.claim_payment_operation('${t}') is null`),'t');
  assert.equal((await creditRow(id)).status,'attention');
  await settle(t); await settle(t); assert.equal((await creditRow(id)).status,'paid');
  await assert.rejects(settle(t,'failed'));
  const v=json(await run(`select row_to_json(v) from public.processing_fee_credit_reconciliation v where id='${c.id}'`));
  assert.equal(v.settlement_matches,true); assert.equal(v.paid_amount,37); assert.equal(v.outstanding_payable_amount,0);
  assert.equal(await scalar(`select count(*) from public.seller_debts where seller_user_id='${f.seller_a}'`),'0');
  await assert.rejects(run(`update public.processing_fee_credits set amount=38 where id='${c.id}'`));
  await assert.rejects(run(`update public.payment_operations set amount=38 where id='${t}'`));
  await assert.rejects(run(`update public.processing_fee_credits set allocation_id=(select id from public.seller_allocations where seller_order_id='${f.b}') where id='${c.id}'`));
});
check('A113 provider failure and missing seller destination remain HolyHub outstanding obligations', async () => {
  const f=await fixture({credit:true}); await run(`delete from public.seller_payment_accounts where seller_user_id='${f.seller_a}'`);
  const id=await refund(f,{amount:600,responsible:false}); await settle(id);
  assert.equal((await creditRow(id)).status,'attention'); assert.equal((await creditRow(id)).payment_operation_id,null);
  await run(`insert into public.seller_payment_accounts(seller_user_id,stripe_account_id,verified_by) values('${f.seller_a}','acct_${f.seller_a}','${f.buyer}')`);
  await recognize(id); const c=await creditRow(id); assert.equal(c.status,'payable');
  await settle(c.payment_operation_id,'failed'); assert.equal((await creditRow(id)).status,'attention');
  assert.equal(await scalar(`select count(*) from public.seller_debts where seller_user_id='${f.seller_a}'`),'0');
});
check('A113 ledger/RPC ACL and A110 privilege matrix preserve server-only financial access', async () => {
  const names=['process_checkout_payment','match_payment_charge','sync_payment_order','request_payment_refund','reserve_seller_transfer',
    'account_payment_refund','claim_payment_operation','settle_payment_operation','restore_payment_stock','reserve_processing_fee_credit'];
  const rows=json(await run(`select json_agg(json_build_object('name',p.proname,'owner',pg_get_userbyid(p.proowner),
    'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),
    'service',has_function_privilege('service_role',p.oid,'EXECUTE'))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (${names.map(n=>`'${n}'`).join(',')})`));
  assert.equal(rows.length,10);
  for(const row of rows) { assert.equal(row.owner,'postgres'); assert.equal(row.anon,false); assert.equal(row.authenticated,false); assert.equal(row.service,true); }
  assert.equal(await scalar(`select has_function_privilege('anon','public.cancel_seller_order_with_refund(uuid,text,text)','EXECUTE')`),'f');
  for(const role of ['authenticated','service_role']) assert.equal(await scalar(`select has_function_privilege('${role}','public.cancel_seller_order_with_refund(uuid,text,text)','EXECUTE')`),'t');
  const f=await fixture({credit:true}); const id=await refund(f,{amount:600,responsible:false});
  for(const role of ['anon','authenticated']) {
    await assert.rejects(run(`set local role ${role}; select public.reserve_processing_fee_credit('${id}')`));
    for(const verb of ['select * from','delete from']) await assert.rejects(run(`set local role ${role}; ${verb} public.processing_fee_credits`));
    await assert.rejects(run(`set local role ${role}; update public.processing_fee_credits set amount=0`));
    await assert.rejects(run(`set local role ${role}; insert into public.processing_fee_credits(refund_operation_id,allocation_id,policy_version) select id,allocation_id,1 from public.payment_operations where id='${id}'`));
  }
  await run(`set local role service_role; select public.settle_payment_operation('${id}',null,'succeeded','re_${id}',600,null)`);
  assert.equal((await creditRow(id)).amount,19);
  assert.equal(await scalar(`select relrowsecurity from pg_class where oid='public.processing_fee_credits'::regclass`),'t');
});
check('A113 zero original gross recognizes zero without a provider transfer',async()=>{
  const f=await fixture({zero:true});
  const id=await scalar(`select public.request_payment_refund('${f.a}','zero-${f.a}','[{"item_id":"${f.item_a}","amount":0,"restore_quantity":1}]',0,'Synthetic zero-gross case',false)`);
  await settle(id);const c=await creditRow(id);assert.equal(c.original_gross,0);assert.equal(c.amount,0);assert.equal(c.status,'not_due');assert.equal(c.payment_operation_id,null);
});
check('A113 migration preserves historical rows and financial-table snapshots without automatic backfill',async()=>{
  assert.deepEqual(historicalMigrationSnapshot.before,historicalMigrationSnapshot.after);
  const id=historicalMigrationSnapshot.id;
  assert.equal((await operation(id)).processing_fee_credit_policy_version,0);await recognize(id);
  assert.equal(await scalar(`select count(*) from public.processing_fee_credits where refund_operation_id='${id}'`),'0');
});
check('A113 London weekly metrics reconcile recognized, paid and outstanding amounts independently of debt',async()=>{
  const totals=json(await run(`select json_build_object('recognized',coalesce(sum(amount) filter(where recognized_at is not null),0),
    'paid',coalesce(sum(amount) filter(where status='paid'),0),
    'outstanding',coalesce(sum(amount) filter(where recognized_at is not null and status<>'paid'),0),
    'attention',coalesce(sum(amount) filter(where status='attention'),0)) from public.processing_fee_credits`));
  assert.equal(totals.recognized,totals.paid+totals.outstanding);
  const metrics=json(await run(`select json_build_object('recognized',sum(recognized_amount),'paid',sum(paid_amount),
    'outstanding',sum(outstanding_payable_amount),'attention',sum(attention_amount)) from public.processing_fee_credit_weekly_metrics`));
  assert.deepEqual(metrics,totals);
  assert.equal(await scalar(`select coalesce(sum(o.amount),0) from public.payment_operations o join public.processing_fee_credits c on c.payment_operation_id=o.id where o.status='succeeded'`),String(totals.paid));
  for(const role of ['anon','authenticated'])for(const view of ['processing_fee_credit_reconciliation','processing_fee_credit_weekly_metrics'])
    await assert.rejects(run(`set local role ${role}; select * from public.${view}`));
});

// Test the prospective upgrade only after the complete, unchanged-behavior A113 phase.
check('A138 upgrade preserves every historical financial row and payment identity',async()=>{
  const snapshot=async()=>json(await run(`select json_build_object('operations',(select md5(string_agg(row_to_json(o)::text,',' order by id)) from public.payment_operations o),
    'credits',(select md5(string_agg(row_to_json(c)::text,',' order by id)) from public.processing_fee_credits c))`));
  const before=await snapshot();
  await q(fs.readFileSync(`supabase/migrations/${fs.readdirSync('supabase/migrations').find(x=>x.includes('a138_'))}`,'utf8'));
  assert.deepEqual(await snapshot(),before);
  assert.equal(await scalar('select count(*) from public.processing_fee_assessments'),'0');
});
async function refundV2(f,{amount=1000,delivery=0,bps=10000,responsible=true,key=crypto.randomUUID(),seller='a'}={}) {
  return scalar(`select public.request_payment_refund('${f[seller]}','${key}','${JSON.stringify(amount?[{item_id:f[`item_${seller}`],amount,restore_quantity:0}]:[])}',${delivery},'A138 verified synthetic case',${responsible},${bps===null?'null':bps})`);
}
async function assessment(id){return json(await run(`select row_to_json(c) from public.processing_fee_assessments c where refund_operation_id='${id}'`));}
async function feeOps(id){return json(await run(`select coalesce(json_agg(row_to_json(o) order by o.created_at,o.id),'[]') from public.payment_operations o
  join public.processing_fee_payments_v2 p on p.operation_id=o.id join public.processing_fee_assessments c on c.id=p.assessment_id where c.refund_operation_id='${id}'`));}
async function rebate(f,id,amount,reference=crypto.randomUUID()) {
  return scalar(`select public.record_processing_fee_reimbursement('${id}','${reference}',${amount},'Verified provider fee reimbursement','${f.buyer}')`);
}
for(const [bps,expected] of [[0,0],[10000,37],[5000,19],[2500,9],[7500,28],[1,0],[9999,37]])
check(`A138 full refund ${bps} basis points credits ${expected}p independently of seller liability`,async()=>{
  const f=await fixture({credit:true});const untouched=await creditSnapshot(f);
  const id=await refundV2(f,{delivery:200,bps});await settle(id);
  const r=await operation(id),c=await assessment(id);
  assert.equal(r.amount,1200);assert.equal(r.details.seller_responsibility,1150);assert.equal(c.amount,expected);
  const ops=await feeOps(id);assert.equal(ops.reduce((s,o)=>s+o.amount,0),expected);
  assert.deepEqual(await creditSnapshot(f),untouched);
});
for(const [amount,delivery,bps,expected] of [[600,0,5000,9],[0,200,5000,3],[400,200,2500,5],[600,0,10000,19]])
check(`A138 product ${amount}p delivery ${delivery}p share ${bps} credits ${expected}p`,async()=>{
  const f=await fixture({credit:true});const id=await refundV2(f,{amount,delivery,bps,responsible:false});await settle(id);
  assert.equal((await assessment(id)).amount,expected);assert.equal((await operation(id)).amount,amount+delivery);
  assert.equal((await operation(id)).details.seller_responsibility,0);
});
check('A138 cumulative half-up rounds once for arbitrary splits and varying responsibility shares',async()=>{
  for(const shares of [[10000,10000,10000],[5000,5000,5000],[0,5000,10000],[3333,6667,2500]]) {
    const f=await fixture({credit:true});let sum=0;
    for(let i=0;i<3;i++){
      const id=await refundV2(f,{amount:i===2?200:400,delivery:i===2?200:0,bps:shares[i]});await settle(id);
      sum+=(await assessment(id)).amount;
    }
    const weighted=shares.reduce((s,x)=>s+400*x,0);
    assert.equal(sum,Math.floor(37*weighted/(1200*10000)+0.5));
    assert.equal(await scalar(`select private.a138_allocation_target(id) from public.seller_allocations where seller_order_id='${f.a}'`),String(sum));
  }
});
check('A138 missing, out-of-range and fractional shares are rejected; changed-share retries conflict',async()=>{
  const f=await fixture({credit:true});
  for(const bps of [null,-1,10001,'0.5']) await assert.rejects(refundV2(f,{amount:100,bps}));
  await assert.rejects(refund(f,{amount:100}));
  const key=crypto.randomUUID();const id=await refundV2(f,{amount:100,bps:5000,key});
  assert.equal(await refundV2(f,{amount:100,bps:5000,key}),id);
  await assert.rejects(refundV2(f,{amount:100,bps:2500,key}));
  await assert.rejects(run(`update public.payment_operations set details=jsonb_set(details,'{fee_responsibility_bps}','10000') where id='${id}'`));
});
check('A138 delayed fee evidence and concurrent recognition serialize and reserve once',async()=>{
  const f=await fixture({credit:true,fee:false});
  const a=await refundV2(f,{amount:400,bps:5000});await settle(a);
  const b=await refundV2(f,{amount:400,bps:7500});await settle(b);
  assert.equal(await scalar(`select count(*) from public.processing_fee_assessments where refund_operation_id in ('${a}','${b}')`),'0');
  await run(`select public.match_payment_charge('${f.order}','pi_${f.checkout}','ch_${f.checkout}',6200,191)`);
  await Promise.all([recognize(a),recognize(b),recognize(a),recognize(b)]);
  const ca=await assessment(a),cb=await assessment(b);assert.equal(ca.amount+cb.amount,15);
  assert.equal((await feeOps(a)).length,1);assert.equal((await feeOps(b)).length,1);
});
for(const [bps,rebateAmount,expected] of [[10000,10,27],[10000,37,0],[5000,10,19],[5000,30,7],[0,37,0]])
check(`A138 ${bps} bps rebate ${rebateAmount}p before claim safely reserves ${expected}p`,async()=>{
  const f=await fixture({credit:true});const other=await creditSnapshot(f);
  const id=await refundV2(f,{delivery:200,bps});await settle(id);
  const before=await feeOps(id),c=await assessment(id);const reference=crypto.randomUUID();
  const b=await rebate(f,id,rebateAmount,reference);assert.equal(await rebate(f,id,rebateAmount,reference),b);
  await assert.rejects(rebate(f,id,rebateAmount===37?36:rebateAmount+1,reference));
  const after=await feeOps(id);const active=after.filter(o=>o.status!=='failed');
  assert.equal(active.reduce((s,o)=>s+o.amount,0),expected);
  assert.deepEqual(await assessment(id),c);
  if(before.length){const superseded=after.find(o=>o.id===before[0].id);assert.equal(superseded.amount,before[0].amount);assert.equal(superseded.status,'failed');}
  assert.equal(await scalar(`select count(*) from public.processing_fee_provider_reimbursements where provider_reference='${reference}'`),'1');
  for(const op of active){const claimed=json(await run(`select public.claim_payment_operation('${op.id}')`));assert.equal(claimed.amount,expected);await settle(op.id);}
  assert.deepEqual(await creditSnapshot(f),other);
});
check('A138 rebate before recognition is included when delayed fee credit is reserved',async()=>{
  const f=await fixture({credit:true});const id=await refundV2(f,{delivery:200,bps:5000});
  // Simulate provider success arriving before fee-credit accounting, without invoking settlement side effects.
  await run(`update public.payment_operations set status='succeeded',stripe_id='re_${id}' where id='${id}'`);
  await rebate(f,id,30);await recognize(id);assert.equal((await feeOps(id))[0].amount,7);
});
check('A138 rebate after paid credit preserves evidence and creates review without debt or clawback',async()=>{
  const f=await fixture({credit:true});const id=await refundV2(f,{delivery:200,bps:5000,responsible:false});await settle(id);
  const op=(await feeOps(id))[0];await run(`select public.claim_payment_operation('${op.id}')`);await settle(op.id);
  const paid=await operation(op.id),c=await assessment(id);
  const b=await rebate(f,id,30);assert.deepEqual(await operation(op.id),paid);assert.deepEqual(await assessment(id),c);
  assert.equal(await scalar(`select reason from public.processing_fee_review_exceptions where reimbursement_id='${b}'`),'rebate_after_payment');
  assert.equal(await scalar(`select count(*) from public.seller_debts where seller_user_id='${f.seller_a}'`),'0');
  assert.equal((await feeOps(id)).length,1);
  const v=json(await run(`select row_to_json(v) from public.processing_fee_reconciliation_v2 v where refund_operation_id='${id}'`));
  assert.equal(v.paid_amount,19);assert.equal(v.allocation_current_entitlement,7);assert.equal(v.requires_review,true);
});
check('A138 rebate during uncertain outcome never authorizes a second transfer and records eventual success',async()=>{
  const f=await fixture({credit:true});const id=await refundV2(f,{delivery:200});await settle(id);
  const op=(await feeOps(id))[0];await run(`select public.claim_payment_operation('${op.id}')`);
  const b=await rebate(f,id,10);assert.equal((await feeOps(id)).length,1);
  assert.equal(await scalar(`select reason from public.processing_fee_review_exceptions where reimbursement_id='${b}'`),'rebate_during_unknown_outcome');
  await settle(op.id);assert.equal((await operation(op.id)).status,'succeeded');
  await assert.rejects(settle(op.id,'failed'));
});
check('A138 over-rebates and cross-seller provider-reference reuse fail; concurrent duplicates record once',async()=>{
  const f=await fixture({credit:true});const a=await refundV2(f,{delivery:200});await settle(a);
  const b=await refundV2(f,{seller:'b',amount:1000});await settle(b);
  await assert.rejects(rebate(f,a,38));const reference=crypto.randomUUID();
  const ids=await Promise.all([rebate(f,a,10,reference),rebate(f,a,10,reference)]);assert.equal(ids[0],ids[1]);
  await assert.rejects(rebate(f,b,10,reference));
  assert.equal(await scalar(`select count(*) from public.processing_fee_provider_reimbursements where refund_operation_id='${b}'`),'0');
});
check('A138 evidence, payments, ACLs and London metrics remain auditable',async()=>{
  const f=await fixture({credit:true});const id=await refundV2(f,{delivery:200});await settle(id);const c=await assessment(id);const op=(await feeOps(id))[0];
  for(const sql of [`update public.processing_fee_assessments set amount=0 where id='${c.id}'`,
    `delete from public.processing_fee_assessments where id='${c.id}'`,
    `update public.processing_fee_payments_v2 set amount=1 where operation_id='${op.id}'`,
    `update public.payment_operations set amount=1 where id='${op.id}'`]) await assert.rejects(run(sql));
  for(const role of ['anon','authenticated']){
    await assert.rejects(run(`set local role ${role}; select * from public.processing_fee_reconciliation_v2`));
    await assert.rejects(run(`set local role ${role}; select public.record_processing_fee_reimbursement('${id}','forbidden',1,'forbidden','${f.buyer}')`));
    await assert.rejects(run(`set local role ${role}; select public.request_payment_refund('${f.a}','forbidden','[]',1,'forbidden',true,5000)`));
  }
  const totals=json(await run(`select json_build_object('assessed',sum(assessed_amount),'paid',sum(paid_amount),'rebated',sum(provider_reimbursed_amount)) from public.processing_fee_weekly_metrics_v2`));
  assert.equal(String(totals.assessed),await scalar('select sum(amount) from public.processing_fee_assessments'));
  assert.equal(String(totals.rebated),await scalar('select sum(amount) from public.processing_fee_provider_reimbursements'));
  assert.equal(String(totals.paid),await scalar(`select sum(p.amount) from public.processing_fee_payments_v2 p join public.payment_operations o on o.id=p.operation_id where o.status='succeeded'`));
});
check('A138 guarded seller cancellation keeps its prior refund, restoration and zero-fee-credit behavior',async()=>{
  const f=await fixture({credit:true});
  const id=await scalar(`select set_config('request.jwt.claims','{"role":"authenticated","sub":"${f.seller_a}"}',true); set local role authenticated;
    select public.cancel_seller_order_with_refund('${f.a}','pending','Seller cancellation');`);
  assert.equal((await operation(id)).details.fee_responsibility_bps,0);assert.equal((await operation(id)).amount,1200);
  await settle(id);assert.equal((await assessment(id)).amount,0);
});
check('A138 pending and failed refunds do not recognize or pay credits',async()=>{
  const f=await fixture({credit:true});const id=await refundV2(f,{amount:600,bps:5000});
  await settle(id,'pending');await recognize(id);assert.equal(await scalar(`select count(*) from public.processing_fee_assessments where refund_operation_id='${id}'`),'0');
  await run(`select public.settle_payment_operation('${id}',null,'failed','re_${id}',600,'provider_refund_failed')`);
  await recognize(id);assert.equal((await feeOps(id)).length,0);
});
check('A138 real seller-lock contention prevents claiming a reservation superseded by a rebate',async()=>{
  const f=await fixture({credit:true});const id=await refundV2(f,{delivery:200});await settle(id);const op=(await feeOps(id))[0];
  const first=run(`set local application_name='a138_rebate_race';select private.payment_seller_lock('${f.seller_a}');select pg_sleep(1);
    select public.record_processing_fee_reimbursement('${id}','race-${id}',10,'Verified racing rebate','${f.buyer}')`);
  let observed=false;
  for(let i=0;i<50;i++){
    if(await scalar(`select count(*) from pg_stat_activity where application_name='a138_rebate_race' and wait_event='PgSleep'`)==='1'){observed=true;break;}
    await new Promise(r=>setTimeout(r,10));
  }
  assert.equal(observed,true);
  const claiming=scalar(`select public.claim_payment_operation('${op.id}') is null`);
  await first;assert.equal(await claiming,'t');assert.equal((await operation(op.id)).status,'failed');
  const live=(await feeOps(id)).filter(o=>o.status!=='failed');assert.equal(live.length,1);assert.equal(live[0].amount,27);
});
check('A138 actual service role can recognize, record evidence and inspect only server-authorized data',async()=>{
  const f=await fixture({credit:true});const id=await refundV2(f,{delivery:200});
  await run(`set local role service_role;select public.settle_payment_operation('${id}',null,'succeeded','re_${id}',1200,null);
    select public.record_processing_fee_reimbursement('${id}','service-${id}',10,'Verified service rebate','${f.buyer}');`);
  assert.equal((await feeOps(id)).filter(o=>o.status!=='failed')[0].amount,27);
  for(const t of ['processing_fee_assessments','processing_fee_payments_v2','processing_fee_provider_reimbursements','processing_fee_review_exceptions']){
    assert.equal(await scalar(`select relrowsecurity from pg_class where oid='public.${t}'::regclass`),'t');
    assert.equal(await scalar(`select has_table_privilege('authenticated','public.${t}','SELECT')`),'f');
  }
});
check('A138 rebates reduce the originating refund loss rather than reimbursing it from another refund',async()=>{
  const f=await fixture({credit:true});const a=await refundV2(f,{amount:600,bps:5000});await settle(a);
  const b=await refundV2(f,{amount:400,delivery:200,bps:10000});await settle(b);
  await rebate(f,a,18);
  const ca=(await feeOps(a)).filter(o=>o.status!=='failed'),cb=(await feeOps(b)).filter(o=>o.status!=='failed');
  assert.equal(ca.reduce((s,o)=>s+o.amount,0),1);assert.equal(cb.reduce((s,o)=>s+o.amount,0),18);
  assert.equal(await scalar(`select private.a138_allocation_target(id) from public.seller_allocations where seller_order_id='${f.a}'`),'19');
});
check('A138 canonical provider references cannot duplicate a reimbursement using whitespace',async()=>{
  const f=await fixture({credit:true});const id=await refundV2(f,{delivery:200});await settle(id);
  const reference=crypto.randomUUID(),b=await rebate(f,id,10,reference);
  assert.equal(await rebate(f,id,10,` ${reference} `),b);
  assert.equal(await scalar(`select count(*) from public.processing_fee_provider_reimbursements where refund_operation_id='${id}'`),'1');
  const op=(await feeOps(id)).find(o=>o.status!=='failed');await run(`select public.claim_payment_operation('${op.id}')`);await settle(op.id);
  assert.equal(await scalar(`select count(*) from public.processing_fee_review_exceptions where operation_id='${op.id}'`),'0');
  await assert.rejects(run(`update public.payment_operations set status='failed' where id='${op.id}'`));
  await assert.rejects(run(`update public.processing_fee_provider_reimbursements set amount=1 where id='${b}'`));
});

let c12LegacyUnpaid,c12LegacyPaid;
const c12Address={delivery_recipient_name:'HolyHub Recipient',delivery_address_line1:'10 Trusted Road',delivery_address_line2:null,delivery_city:'London',delivery_postcode:'SW1A 1AA',delivery_country:'GB'};
function c12Source(postcode='SW1A 1AA') {
  return fixtureSource.replace('seller_amount_total)\n  values (checkout_id, buyer, stripe_id,', 'seller_amount_total,delivery_address)\n  values (checkout_id, buyer, stripe_id,')
    .replace(/(values \(checkout_id, buyer, stripe_id,[^;]+)\);/, `$1,'${JSON.stringify({...c12Address,delivery_postcode:postcode})}'::jsonb);`);
}
async function c12Unpaid(postcode='SW1A 1AA') {return json(await run(`${c12Source(postcode)} select pg_temp.payment_fixture();`));}
check('C12 additive migration preserves existing checkouts, orders and financial rows without backfill',async()=>{
  c12LegacyUnpaid=json(await run(`${fixtureSource} select pg_temp.payment_fixture();`));c12LegacyPaid=await fixture();
  const snapshot=async()=>json(await run(`select json_build_object('checkouts',(select md5(string_agg((to_jsonb(c)-'delivery_address')::text,',' order by id)) from public.checkout_sessions c),
    'orders',(select md5(string_agg(to_jsonb(o)::text,',' order by id)) from public.orders o),
    'operations',(select md5(string_agg(to_jsonb(o)::text,',' order by id)) from public.payment_operations o))`));
  const before=await snapshot();
  await q(fs.readFileSync(`supabase/migrations/${fs.readdirSync('supabase/migrations').find(x=>x.includes('c12_delivery_territory'))}`,'utf8'));
  c12Enabled=true;assert.deepEqual(await snapshot(),before);
  assert.equal(await scalar('select count(*) from public.ni_shipping_interest'),'0');
  assert.equal(await scalar('select count(*) from public.checkout_sessions where delivery_address is not null'),'0');
});
for(const postcode of ['SW1A 1AA','EH1 1YZ','CF10 1EP','EC1R 1BB'])
check(`C12 ${postcode} snapshot creates paid order under actual service role and ignores forged Stripe address`,async()=>{
  const f=await c12Unpaid(postcode);
  const id=await scalar(`set local role service_role;select public.process_checkout_payment('${f.stripe}','paid','paid',7200,'gbp','pi_${f.checkout}',
    '{"delivery_recipient_name":"FORGED","delivery_address_line1":"SECRET NI ADDRESS","delivery_postcode":"BT7 1NN","delivery_country":"GB"}')`);
  const order=json(await run(`select row_to_json(o) from public.orders o where id='${id}'`));
  assert.equal(order.delivery_postcode,postcode);assert.equal(order.delivery_address_line1,'10 Trusted Road');assert.equal(order.delivery_recipient_name,'HolyHub Recipient');
  assert.equal(order.total_amount,7200);assert.equal(order.holyhub_commission,325);
  assert.equal(await scalar(`select count(*) from public.seller_orders where order_id='${id}'`),'2');
  assert.equal(await scalar(`select count(*) from public.seller_allocations where order_id='${id}'`),'2');
  assert.equal(await scalar(`select stock_quantity from public.products where id='${f.base}'`),'7');
  await run(`set local role service_role;select public.process_checkout_payment('${f.stripe}','paid','paid',7200,'gbp','pi_${f.checkout}','{}')`);
  assert.equal(await scalar(`select stock_quantity from public.products where id='${f.base}'`),'7');
});
for(const postcode of ['BT7 1NN','GY1 1AA','JE2 3AA','IM1 1AA','BF1 0AA','ZZ1 1AA','invalid'])
check(`C12 database guard rejects unsupported ${postcode} even for a privileged direct insert`,async()=>{
  await assert.rejects(c12Unpaid(postcode));
});
check('C12 checkout snapshot is immutable and cannot be reattributed or overwritten after Stripe creation',async()=>{
  const f=await c12Unpaid();
  await assert.rejects(run(`update public.checkout_sessions set delivery_address=jsonb_set(delivery_address,'{delivery_postcode}','"BT7 1NN"') where id='${f.checkout}'`));
  await assert.rejects(run(`update public.checkout_sessions set user_id='${f.seller_a}' where id='${f.checkout}'`));
  await assert.rejects(run(`update public.checkout_sessions set stripe_checkout_session_id='forged' where id='${f.checkout}'`));
});
check('C12 missing trusted legacy address cannot authorize new shipping; existing paid order replays remain intact',async()=>{
  const f=c12LegacyUnpaid;
  await assert.rejects(run(`select public.process_checkout_payment('${f.stripe}','paid','paid',7200,'gbp','legacy_pi','${JSON.stringify(c12Address)}')`),/legacy checkout needs review/);
  const paid=c12LegacyPaid;
  const before=json(await run(`select row_to_json(o) from public.orders o where id='${paid.order}'`));
  await run(`select public.process_checkout_payment('cs_test_regression_${paid.checkout}','paid','paid',7200,'gbp','pi_${paid.checkout}','{}')`);
  assert.deepEqual(json(await run(`select row_to_json(o) from public.orders o where id='${paid.order}'`)),before);
});
check('C12 failed/expired sessions still reconcile without inventing an address or order',async()=>{
  const f=await c12Unpaid();
  await run(`select public.process_checkout_payment('${f.stripe}','cancelled','unpaid',7200,'gbp',null,'{}')`);
  assert.equal(await scalar(`select status from public.checkout_sessions where id='${f.checkout}'`),'cancelled');
  assert.equal(await scalar(`select count(*) from public.orders where checkout_session_id='${f.checkout}'`),'0');
});
check('C12 NI demand table is server-only, deduplicates and cannot accept full address payloads',async()=>{
  const f=await c12Unpaid();
  const items=[{product_id:f.base,product_name:'Book',seller_user_id:f.seller_a,seller_brand:'Payment fixture A',quantity:1,variant_id:null,variant_size:null}];
  const insert=`insert into public.ni_shipping_interest(user_id,postcode_area,demand_key,demand_items) values('${f.buyer}','BT7',repeat('a',64),'${JSON.stringify(items)}')`;
  await run(`set local role service_role;${insert} on conflict(user_id,postcode_area,demand_key) do update set notification_email=excluded.notification_email;${insert} on conflict do nothing`);
  const row=json(await run(`select row_to_json(n) from public.ni_shipping_interest n where user_id='${f.buyer}'`));
  assert.equal(row.user_id,f.buyer);assert.equal(row.postcode_area,'BT7');assert.ok(row.requested_at);assert.equal(row.notification_email,null);
  assert.equal(row.demand_items[0].seller_user_id,f.seller_a);
  assert.equal(await scalar(`select count(*) from public.ni_shipping_interest where user_id='${f.buyer}'`),'1');
  const malicious=[{...items[0],delivery_address_line1:'SECRET NI ADDRESS'}];
  await assert.rejects(run(`update public.ni_shipping_interest set demand_items='${JSON.stringify(malicious)}' where id='${row.id}'`));
  await assert.rejects(run(`update public.ni_shipping_interest set postcode_area='BT7 1NN' where id='${row.id}'`));
  for(const role of ['anon','authenticated']){
    await assert.rejects(run(`set local role ${role};select * from public.ni_shipping_interest`));
    await assert.rejects(run(`set local role ${role};${insert}`));
  }
  assert.equal(await scalar(`select relrowsecurity from pg_class where oid='public.ni_shipping_interest'::regclass`),'t');
  assert.equal(await scalar(`select prosecdef from pg_proc where oid='public.process_checkout_payment(text,text,text,integer,text,text,jsonb)'::regprocedure`),'f');
  assert.equal(await scalar(`select has_function_privilege('authenticated','public.process_checkout_payment(text,text,text,integer,text,text,jsonb)','EXECUTE')`),'f');
});
check('C12 preserves A138 shared fee responsibility and C11 seller-isolated refunds after trusted checkout',async()=>{
  const f=await fixture({credit:true});
  const id=await refundV2(f,{amount:600,bps:5000,responsible:false});await settle(id);
  assert.equal((await assessment(id)).amount,9);assert.equal((await operation(id)).amount,600);
  assert.equal(await scalar(`select count(*) from public.seller_debts where seller_user_id='${f.seller_b}'`),'0');
});
