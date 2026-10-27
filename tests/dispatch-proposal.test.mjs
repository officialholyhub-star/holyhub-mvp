// Offline review of STAGED proposal. Never executes SQL, calls Stripe/Supabase,
// applies the patch or invokes the optional real-Postgres test harness.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { loadTypescript } from './helpers/load-typescript.mjs';
const draft = 'docs/proposals/dispatch-promises/';
const helper = loadTypescript(`${draft}dispatch-promise.ts`);
const valid = { dispatch_min_working_days: 2, dispatch_max_working_days: 3, dispatch_made_to_order: false, transit_min_working_days: 2, transit_max_working_days: 4 };
const when = '2026-10-09T10:00:00.000Z';
const orderId = '11111111-1111-4111-8111-111111111111';
const input = { eventId: 'evt_stable', eventType: 'checkout.session.completed', eventCreated: 1791540000, sessionId: 'cs_test_dispatch', paymentStatus: 'paid', orderId };
function moduleFrom(file, dependencies) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file.replace(/\.txt$/, ''), compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, process: { env: { STRIPE_WEBHOOK_SECRET: 'whsec_fixture' } }, console: { info() {}, error() {} }, Date, Map, Set, Number, URL, Response, AbortSignal });
  return exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
test('typed promise is an independent copy; later shop edits do not alter checkout terms', () => {
  const shop = { ...valid };
  const saved = helper.snapshotDispatchPromise(shop, when);
  shop.dispatch_max_working_days = 7;
  assert.equal(saved.dispatch_max_working_days, 3);
  assert.equal(saved.dispatch_promise_version, 1);
  assert.equal(saved.dispatch_promise_captured_at, when);
});
test('unknown/invalid settings never become fabricated promises', () => {
  for (const bad of [{}, { ...valid, dispatch_max_working_days: '3' }, { ...valid, dispatch_max_working_days: 1 }, { ...valid, dispatch_min_working_days: 0 }, { ...valid, dispatch_max_working_days: 366 }, { ...valid, dispatch_made_to_order: null }, { ...valid, transit_max_working_days: null }, { ...valid, transit_max_working_days: 1 }]) assert.equal(helper.snapshotDispatchPromise(bad, when), null);
  assert.equal(helper.snapshotDispatchPromise(valid, 'invalid'), null);
  assert.ok(helper.snapshotDispatchPromise({ ...valid, dispatch_made_to_order: true, dispatch_min_working_days: 10, dispatch_max_working_days: 20, transit_min_working_days: null, transit_max_working_days: null }, when));
});
test('event timestamp is stable on replay; unpaid/unrelated events cannot supply a deadline', () => {
  const first = plain(helper.dispatchConfirmationArguments(input));
  assert.equal(first.p_confirmed_at, new Date(input.eventCreated * 1000).toISOString());
  assert.deepEqual(plain(helper.dispatchConfirmationArguments(input)), first);
  for (const bad of [{ ...input, paymentStatus: 'unpaid' }, { ...input, eventType: 'checkout.session.expired' }, { ...input, eventCreated: 1.5 }, { ...input, eventCreated: Number.MAX_SAFE_INTEGER }, { ...input, eventId: 'not-event' }]) assert.equal(helper.dispatchConfirmationArguments(bad), null);
});
test('enrichment failures, thrown errors and timeout preserve the already committed payment', async () => {
  for (const rpc of [() => { throw new Error('database down'); }, () => ({ abortSignal: async () => ({ error: { code: 'PGRST202' } }) }), () => ({ abortSignal: async signal => { assert.ok(signal instanceof AbortSignal); throw new Error('timeout'); } })]) {
    assert.equal(await helper.recordDispatchConfirmation({ rpc }, input), 'unavailable');
  }
});
async function checkout(file) {
  const calls = []; const stripeCalls = [];
  const shops = [
    { user_id: 'seller-a', business_name: 'A', delivery_country: 'GB', delivery_option: 'flat', delivery_charge: 2.99, ...valid },
    { user_id: 'seller-b', business_name: 'B', delivery_country: 'GB', delivery_option: 'free', delivery_charge: 0, ...valid, dispatch_min_working_days: 5, dispatch_max_working_days: 7 },
    { user_id: 'seller-c', business_name: 'Legacy C', delivery_country: 'GB', delivery_option: 'free', delivery_charge: 0 },
  ];
  const products = shops.map((shop, i) => ({ id: `${i + 1}1111111-1111-4111-8111-111111111111`, name: shop.business_name, price: 10 + i, currency: 'GBP', lister_user_id: shop.user_id, review_status: 'approved', is_published: true, stock_quantity: 10, category_type: 'Gifts', product_variants: [] }));
  const db = { from(table) {
    const call = { table }; calls.push(call);
    const query = { select(value) { call.select = value; return this; }, in() { return this; }, eq() { return this; }, single() { return this; }, insert(value) { call.insert = plain(value); return this; },
      then(resolve) { resolve({ error: null, data: table === 'products' ? products : table === 'lister_storefronts' ? shops : table === 'checkout_sessions' ? { id: 'checkout' } : null }); },
    }; return query;
  }};
  const { startCheckout } = moduleFrom(file, {
    '@/lib/dispatch-promise': helper,
    'next/navigation': { redirect: value => { throw new Error(`REDIRECT:${value}`); } },
    'next/cache': { revalidatePath() {} }, 'next/headers': { headers: async () => new Headers() },
    '@/lib/auth/require-user': { requireUser: async () => ({ supabase: db, user: { id: 'customer', email: 'fixture@example.test' } }) },
    '@/lib/supabase/admin': { createAdminClient: () => db },
    '@/lib/stripe': { getStripe: () => ({ checkout: { sessions: { create: async args => { stripeCalls.push(plain(args)); return { id: 'cs_test_dispatch', url: 'https://checkout.stripe.test/session' }; }, expire: async () => { throw new Error('Unexpected expiry'); } } } }) },
    '@/lib/checkout-origin': { checkoutRedirectUrls: () => ({ success_url: 'https://holyhub.test/success', cancel_url: 'https://holyhub.test/cancel' }) },
    '@/lib/basket': { MAX_BASKET_ITEMS: 50, MAX_BASKET_QUANTITY: 20 },
    '@/lib/checkout-pricing': loadTypescript('lib/checkout-pricing.ts'),
  });
  const form = new FormData(); form.set('accept_terms', 'on');
  form.set('basket', JSON.stringify(products.map(product => ({ id: product.id, quantity: 1 }))));
  await assert.rejects(startCheckout(form), /REDIRECT:https:\/\/checkout.stripe.test\/session/);
  return { calls, stripeCalls };
}
// Superseded by the implemented C5/C6 seller-identity and confirmation architecture;
// retained as historical proposal review rather than a current-code contract test.
test.skip('staged multi-lister checkout preserves exact Stripe request/totals and snapshots by seller including free delivery', async () => {
  const original = await checkout('app/checkout/actions.ts');
  const staged = await checkout(`${draft}app/checkout/actions.ts.txt`);
  assert.deepEqual(staged.stripeCalls, original.stripeCalls);
  assert.deepEqual(staged.calls.find(c => c.table === 'checkout_sessions').insert, original.calls.find(c => c.table === 'checkout_sessions').insert);
  assert.deepEqual(staged.calls.find(c => c.table === 'checkout_session_items').insert, original.calls.find(c => c.table === 'checkout_session_items').insert);
  const sellers = staged.calls.find(c => c.table === 'checkout_session_sellers').insert;
  assert.equal(sellers.length, 3);
  assert.equal(sellers.find(s => s.lister_user_id === 'seller-a').dispatch_max_working_days, 3);
  assert.equal(sellers.find(s => s.lister_user_id === 'seller-b').dispatch_max_working_days, 7);
  assert.equal(sellers.find(s => s.lister_user_id === 'seller-b').delivery_total, 0);
  assert.equal(sellers.find(s => s.lister_user_id === 'seller-c').dispatch_promise_version, undefined);
});
async function webhook(file, timingError = false, eventType = input.eventType, paymentStatus = 'paid') {
  const calls = [];
  const session = { id: input.sessionId, payment_status: paymentStatus, amount_total: 7200, currency: 'gbp', payment_intent: 'pi_fixture' };
  const { POST } = moduleFrom(file, {
    '@/lib/stripe-processing-fee': { getStripeProcessingFee: async () => null },
    '@/lib/dispatch-promise': helper,
    'next/server': { NextResponse: { json: (value, options) => Response.json(value, options) } },
    '@/lib/stripe': { getStripe: () => ({ webhooks: { constructEvent: () => ({ id: input.eventId, created: input.eventCreated, type: eventType, livemode: false, data: { object: session } }) } }) },
    '@/lib/supabase/admin': { createAdminClient: () => ({ rpc(name, args) {
      calls.push({ name, args: plain(args) });
      if (name === 'record_order_dispatch_confirmation') return { abortSignal: async () => { if (timingError) throw new Error('timeout'); return { error: null, data: 2 }; } };
      return Promise.resolve({ error: null, data: orderId });
    } }) },
  });
  const response = await POST(new Request('https://holyhub.test/webhook', { method: 'POST', headers: { 'stripe-signature': 'fixture' }, body: 'signed-fixture' }));
  return { calls, status: response.status, body: await response.json() };
}
test.skip('staged webhook preserves original payment arguments/response and enriches only after success', async () => {
  const original = await webhook('app/api/stripe/webhook/route.ts');
  for (const failure of [false, true]) {
    const staged = await webhook(`${draft}app/api/stripe/webhook/route.ts.txt`, failure);
    assert.deepEqual(staged.calls[0], original.calls[0]);
    assert.equal(staged.calls[1].name, 'record_order_dispatch_confirmation');
    assert.equal(staged.calls[1].args.p_order_id, orderId);
    assert.equal(staged.calls[1].args.p_confirmed_at, new Date(input.eventCreated * 1000).toISOString());
    assert.equal(staged.status, original.status);
    assert.deepEqual(staged.body, original.body);
  }
});
test.skip('staged webhook preserves unpaid, delayed-success, cancellation and failed-payment behaviour', async () => {
  for (const [event, payment] of [['checkout.session.completed', 'unpaid'], ['checkout.session.async_payment_succeeded', 'paid'], ['checkout.session.expired', 'unpaid'], ['checkout.session.async_payment_failed', 'unpaid']]) {
    const original = await webhook('app/api/stripe/webhook/route.ts', false, event, payment);
    const staged = await webhook(`${draft}app/api/stripe/webhook/route.ts.txt`, false, event, payment);
    assert.equal(staged.status, original.status);
    assert.deepEqual(staged.body, original.body);
    assert.deepEqual(staged.calls.filter(call => call.name === 'process_checkout_payment'), original.calls);
    assert.equal(staged.calls.filter(call => call.name === 'record_order_dispatch_confirmation').length, event === 'checkout.session.async_payment_succeeded' ? 1 : 0);
  }
});
test('payment SQL changes only typed snapshot copying, not calculation/status/stock logic (text comparison only)', () => {
  const current = fs.readFileSync('supabase/migrations/023_webhook_order_integrity.sql', 'utf8');
  const proposal = fs.readFileSync('docs/proposals/dispatch-promises.sql', 'utf8');
  const extract = text => text.slice(text.indexOf('function public.process_checkout_payment('), text.indexOf('revoke all on function public.process_checkout_payment'));
  const fields = ['dispatch_promise_version', 'dispatch_min_working_days', 'dispatch_max_working_days', 'dispatch_made_to_order', 'transit_min_working_days', 'transit_max_working_days', 'dispatch_promise_captured_at'];
  let proposed = extract(proposal);
  proposed = proposed.replace(',\n    ' + fields.join(', '), '').replace(',\n    ' + fields.map(f => `s.${f}`).join(', '), '');
  assert.equal(proposed, extract(current));
  assert.doesNotMatch(proposal, /(?:create|alter|drop) policy|disable row level security/i);
  assert.doesNotMatch(extract(proposal), /holyhub_dispatch_deadline|dispatch_due_at|dispatch_promise_snapshot/);
  assert.match(proposal, /so\.dispatch_promise_version = 1 and so\.dispatch_due_at is null/);
});
