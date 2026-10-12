import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(fs.readFileSync('app/api/stripe/webhook/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
function handler(type, session, { rpcError = null, signatureError = false, rpcThrows = false, secret = 'test', orderId = 'order-test', exceptionMessage = 'secret-payload' } = {}) {
  const calls = [];
  const logs = [];
  const exports = {};
  vm.runInNewContext(code, {
    exports, process: { env: { STRIPE_WEBHOOK_SECRET: secret } }, console: { error: (...args) => logs.push(args), info: (...args) => logs.push(args) },
    require(name) {
      if (name === 'next/server') return { NextResponse: { json: (value, options) => Response.json(value, options) } };
      if (name === '@/lib/stripe') return { getStripe: () => ({ webhooks: { constructEvent(body, signature, key) {
        assert.equal(body, 'signed-body'); assert.equal(signature, 'test-signature'); assert.equal(key, 'test');
        if (signatureError) throw new Error(exceptionMessage);
        return { id: 'evt_test', type, livemode: false, data: { object: session } };
      } } }) };
      if (name === '@/lib/supabase/admin') return { createAdminClient: () => ({ rpc: async (name, args) => {
        calls.push({ name, args }); if (rpcThrows) throw new Error(exceptionMessage); return { error: rpcError, data: orderId };
      } }) };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return { calls, logs, invoke: (signature = 'test-signature') => exports.POST(new Request('https://example.com/webhook', {
    method: 'POST', headers: signature ? { 'stripe-signature': signature } : {}, body: 'signed-body',
  })) };
}
const paid = { id: 'cs_test_payment', payment_status: 'paid', currency: 'gbp', amount_total: 7200, payment_intent: 'pi_test_payment' };
test('unpaid completion performs no database or stock operation; later async success invokes the atomic RPC', async () => {
  for (const type of ['checkout.session.completed', 'checkout.session.async_payment_succeeded']) {
    for (const payment_status of ['unpaid', 'no_payment_required', undefined]) {
      const h = handler(type, { ...paid, payment_status });
      assert.equal((await h.invoke()).status, 200); assert.equal(h.calls.length, 0);
    }
  }
  const h = handler('checkout.session.async_payment_succeeded', paid);
  assert.equal((await h.invoke()).status, 200);
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].name, 'process_checkout_payment');
  assert.equal(h.calls[0].args.p_status, 'paid'); assert.equal(h.calls[0].args.p_payment_intent_id, paid.payment_intent);
});
test('both success event types use the same Checkout Session identity on sequential and concurrent delivery', async () => {
  for (const type of ['checkout.session.completed', 'checkout.session.async_payment_succeeded']) {
    const h = handler(type, paid);
    const responses = await Promise.all([h.invoke(), h.invoke()]);
    assert.ok(responses.every(r => r.status === 200));
    assert.equal(h.calls.length, 2);
    for (const call of h.calls) assert.equal(call.args.p_stripe_session_id, paid.id);
  }
});
test('bad signatures and missing configuration fail before database access', async () => {
  for (const options of [{ signatureError: true }, { secret: '' }]) {
    const h = handler('checkout.session.completed', paid, options);
    assert.equal((await h.invoke()).status, options.secret === '' ? 500 : 400); assert.equal(h.calls.length, 0);
  }
  const h = handler('checkout.session.completed', paid);
  assert.equal((await h.invoke(null)).status, 400); assert.equal(h.calls.length, 0);
});
test('logs correlate receipt and processing without printing secrets or customer data', async () => {
  const session = { ...paid, metadata: { holyhub_user_id: 'private-user' }, collected_information: { shipping_details: { name: 'PRIVATE NAME', address: { line1: 'PRIVATE ADDRESS' } } } };
  const h = handler('checkout.session.completed', session);
  assert.equal((await h.invoke()).status, 200);
  const logs = JSON.stringify(h.logs);
  for (const value of ['evt_test', paid.id, 'order-test', 'Stripe webhook received', 'Stripe webhook processed']) assert.ok(logs.includes(value));
  for (const value of ['private-user', 'PRIVATE NAME', 'PRIVATE ADDRESS', 'test-signature', 'secret-payload']) assert.ok(!logs.includes(value));
});
test('signature, thrown and database errors log only allowlisted diagnostics', async () => {
  for (const options of [{ signatureError: true }, { rpcThrows: true }, { rpcError: { code: '23505', message: 'PRIVATE ADDRESS secret-payload', details: 'PRIVATE NAME' } }]) {
    const h = handler('checkout.session.completed', paid, options);
    assert.ok((await h.invoke()).status >= 400);
    const logs = JSON.stringify(h.logs);
    assert.ok(!logs.includes('secret-payload'));
    assert.ok(!logs.includes('PRIVATE'));
  }
  const h = handler('checkout.session.completed', paid, { rpcError: { code: 'PGRST202' } });
  assert.equal((await h.invoke()).status, 500);
  assert.ok(JSON.stringify(h.logs).includes('Payment processor function is unavailable.'));
});
test('paid transactions without an order ID are retryable rather than silently acknowledged', async () => {
  const h = handler('checkout.session.completed', paid, { orderId: null });
  assert.equal((await h.invoke()).status, 500);
  assert.ok(JSON.stringify(h.logs).includes('returned no order'));
});
test('invalid amounts/currency do not fulfil and unrelated events are acknowledged', async () => {
  for (const invalid of [{ amount_total: null }, { amount_total: -1 }, { amount_total: 1.5 }, { amount_total: '7200' }, { currency: 'usd' }]) {
    const h = handler('checkout.session.completed', { ...paid, ...invalid });
    assert.equal((await h.invoke()).status, 400); assert.equal(h.calls.length, 0);
  }
  const h = handler('payment_intent.succeeded', paid);
  assert.equal((await h.invoke()).status, 200); assert.equal(h.calls.length, 0);
});
test('database failures return retryable errors rather than acknowledging a partial order', async () => {
  for (const options of [{ rpcError: { code: 'P0001' } }, { rpcThrows: true }]) {
    const h = handler('checkout.session.completed', paid, options);
    assert.equal((await h.invoke()).status, 500); assert.equal(h.calls.length, 1);
  }
});
test('failure and expiry events use the same serialized transaction without a paid fulfilment request', async () => {
  for (const [type, status] of [['checkout.session.expired', 'cancelled'], ['checkout.session.async_payment_failed', 'failed']]) {
    const h = handler(type, { ...paid, payment_status: 'unpaid' });
    assert.equal((await h.invoke()).status, 200); assert.equal(h.calls[0].args.p_status, status);
  }
});
