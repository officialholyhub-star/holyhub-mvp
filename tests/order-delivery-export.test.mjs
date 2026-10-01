import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import * as fulfilment from '../lib/fulfilment.ts';

function load(file, dependencies, extra = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, URL, Response, console, ...extra });
  return exports;
}
const next = { NextResponse: class extends Response {
  static json(body, options) { return new Response(JSON.stringify(body), { ...options, headers: { 'Content-Type': 'application/json' } }); }
} };
function database(tables, writes = []) {
  return { from(table) {
    let rows = tables[table] ?? [];
    let inserted = false;
    const query = {
      select() { return query; },
      eq(key, value) { rows = rows.filter(row => row[key] === value); return query; },
      in(key, values) { rows = rows.filter(row => values.includes(row[key])); return query; },
      order() { return query; },
      insert(value) { writes.push({ table, value }); inserted = true; return query; },
      update() { return query; },
      maybeSingle() { return Promise.resolve({ data: rows[0] ?? null, error: null }); },
      single() { return Promise.resolve({ data: inserted ? { id: 'new-order' } : rows[0], error: null }); },
      then(resolve, reject) { return Promise.resolve({ data: rows, error: null }).then(resolve, reject); },
    };
    return query;
  }, rpc: async () => ({ error: null }), auth: { admin: { getUserById: async id => ({ data: { user: { email: `${id}@example.com` } } }) } } };
}
const address = { delivery_recipient_name: 'Recipient', delivery_address_line1: '10 Real Road', delivery_address_line2: 'Flat 2', delivery_city: 'London', delivery_postcode: 'SW1A 1AA', delivery_country: 'GB' };
const ownId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const deliveredId = '33333333-3333-4333-8333-333333333333';
function exportRoute() {
  const tables = {
    seller_orders: [
      { id: ownId, order_id: 'shared', seller_user_id: 'seller-a', fulfilment_status: 'pending', carrier: 'Other', carrier_other: 'Local courier', orders: { user_id: 'customer-a', created_at: '2026-10-01', ...address } },
      { id: otherId, order_id: 'private', seller_user_id: 'seller-b', fulfilment_status: 'pending', orders: { user_id: 'customer-b', delivery_address_line1: 'SECRET ADDRESS' } },
      { id: deliveredId, order_id: 'delivered', seller_user_id: 'seller-a', fulfilment_status: 'delivered', orders: { user_id: 'customer-a', ...address } },
    ],
    order_items: [
      { order_id: 'shared', seller_user_id: 'seller-a', product_name: 'T-shirt, blue', variant_size: 'M', quantity: 2 },
      { order_id: 'shared', seller_user_id: 'seller-a', product_name: 'Hoodie', variant_size: 'L', quantity: 1 },
      { order_id: 'shared', seller_user_id: 'seller-b', product_name: 'SECRET SHARED ITEM', quantity: 1 },
      { order_id: 'private', seller_user_id: 'seller-b', product_name: 'SECRET PRODUCT', quantity: 1 },
      { order_id: 'delivered', seller_user_id: 'seller-a', product_name: 'Delivered item', quantity: 1 },
    ], profiles: [{ id: 'customer-a', full_name: 'Customer A' }, { id: 'customer-b', full_name: 'SECRET CUSTOMER' }],
  };
  const db = database(tables);
  return load('app/lister/orders/export/route.ts', { 'next/server': next, '@/lib/auth/require-user': { requireRole: async role => { assert.equal(role, 'lister'); return { supabase: db, user: { id: 'seller-a' } }; } }, '@/lib/supabase/admin': { createAdminClient: () => db }, '@/lib/fulfilment': fulfilment }).GET;
}
test('paid webhook passes real shipping fields to the atomic order transaction', async () => {
  const calls = [];
  const db = { rpc: async (name, args) => { calls.push({ name, args }); return { error: null }; } };
  const session = { id: 'stripe-session', payment_status: 'paid', currency: 'gbp', amount_total: 1200, collected_information: { shipping_details: { name: 'Recipient', address: { line1: '10 Real Road', line2: 'Flat 2', city: 'London', postal_code: 'SW1A 1AA', country: 'GB' } } } };
  const { POST } = load('app/api/stripe/webhook/route.ts', { 'next/server': next, '@/lib/stripe': { getStripe: () => ({ webhooks: { constructEvent: () => ({ type: 'checkout.session.completed', data: { object: session } }) } }) }, '@/lib/supabase/admin': { createAdminClient: () => db } }, { process: { env: { STRIPE_WEBHOOK_SECRET: 'test' } } });
  const response = await POST(new Request('https://example.com/webhook', { method: 'POST', headers: { 'stripe-signature': 'test' }, body: '{}' }));
  assert.equal(response.status, 200);
  assert.equal(calls[0].name, 'process_checkout_payment');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].args.p_delivery_address)), address);
  // Older Checkout Sessions may contain no shipping information; never fabricate it.
  delete session.collected_information;
  await POST(new Request('https://example.com/webhook', { method: 'POST', headers: { 'stripe-signature': 'test' }, body: '{}' }));
  for (const key of Object.keys(address)) assert.equal(calls[1].args.p_delivery_address[key], null);
});
test('selected export accepts repeated and comma-separated IDs but excludes another seller and shared-order items', async () => {
  for (const ids of [`ids=${ownId}&ids=${otherId}`, `ids=${ownId},${otherId}`]) {
    const response = await exportRoute()(new Request(`https://example.com/export?scope=selected&${ids}`));
    assert.equal(response.status, 200);
    const csv = await response.text();
    assert.ok(csv.includes(fulfilment.formatDeliveryAddress(address)));
    assert.ok(csv.includes('"T-shirt, blue",,M,2'));
    assert.ok(csv.includes('Hoodie,,L,1'));
    assert.ok(csv.includes('Local courier'));
    assert.equal(csv.split('\r\n').filter(Boolean).length, 3);
    assert.ok(!csv.includes('SECRET'));
    assert.ok(!csv.includes('Delivered item'));
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});
test('unfulfilled export preserves filtering; selected export can include delivered orders', async () => {
  const unfulfilled = await exportRoute()(new Request('https://example.com/export?scope=unfulfilled'));
  assert.ok(!(await unfulfilled.text()).includes('Delivered item'));
  const selected = await exportRoute()(new Request(`https://example.com/export?scope=selected&ids=${deliveredId}`));
  assert.ok((await selected.text()).includes('Delivered item'));
});
test('foreign-only selection exports no customer data; empty, malformed and invalid-scope requests are rejected', async () => {
  const foreign = await exportRoute()(new Request(`https://example.com/export?scope=selected&ids=${otherId}`));
  assert.equal((await foreign.text()).split('\r\n').filter(Boolean).length, 1);
  for (const query of ['scope=selected', 'scope=selected&ids=------------------------------------', 'scope=anything']) assert.equal((await exportRoute()(new Request(`https://example.com/export?${query}`))).status, 400);
});
test('customer page filters to its owner and the migration retains customer/seller/admin address authorization', () => {
  const page = fs.readFileSync('app/account/orders/page.tsx', 'utf8');
  assert.ok(page.includes('.eq("user_id", user.id)'));
  const migration = fs.readFileSync('supabase/migrations/019_order_delivery_address.sql', 'utf8');
  assert.ok(migration.includes('seller_user_id = (select auth.uid())'));
  assert.ok(migration.includes('user_id = (select auth.uid())'));
  assert.ok(migration.includes("private.has_role('admin')"));
  assert.ok(migration.includes("set search_path = ''"));
  assert.ok(migration.includes('from public, anon'));
  assert.ok(fs.readFileSync('app/checkout/actions.ts', 'utf8').includes('shipping_address_collection: { allowed_countries: ["GB"] }'));
});

test('lister page shows only its delivery address, items and selected-order controls', async () => {
  const db = database({ seller_orders: [
    { id: ownId, order_id: 'own-order', seller_user_id: 'seller-a', fulfilment_status: 'pending', orders: { user_id: 'customer-a', ...address } },
    { id: otherId, order_id: 'other-order', seller_user_id: 'seller-b', fulfilment_status: 'pending', orders: { user_id: 'customer-b', delivery_address_line1: 'SECRET ADDRESS' } },
  ], order_items: [
    { order_id: 'own-order', seller_user_id: 'seller-a', product_name: 'Shirt', variant_size: 'M', quantity: 1 },
    { order_id: 'own-order', seller_user_id: 'seller-b', product_name: 'SECRET ITEM', quantity: 1 },
  ] });
  const page = load('app/lister/orders/page.tsx', { 'react/jsx-runtime': jsxRuntime, 'next/link': { default: props => React.createElement('a', props) }, '@/lib/auth/require-user': { requireRole: async () => ({ supabase: db, user: { id: 'seller-a' } }) }, '@/lib/supabase/admin': { createAdminClient: () => db }, './actions': { updateSellerFulfilment: '/test-action' }, '@/lib/fulfilment': fulfilment }).default;
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
  assert.ok(html.includes('10 Real Road'));
  assert.ok(html.includes('Size M'));
  assert.ok(html.includes('form="selected-order-export"'));
  assert.ok(!html.includes('SECRET'));
  assert.ok(!html.includes(otherId));
});
test('customer order page displays only the signed-in customer address and retains tracking and sizes', async () => {
  const db = database({ orders: [
    { id: 'own-order', user_id: 'customer-a', created_at: '2026-10-01', total_amount: 1200, ...address, seller_orders: [{ id: ownId, seller_user_id: 'seller-a', seller_business_name: 'Shop', fulfilment_status: 'dispatched', carrier: 'DPD', tracking_number: 'TRACK123', tracking_url: 'https://example.com/track' }] },
    { id: 'other-order', user_id: 'customer-b', delivery_address_line1: 'SECRET ADDRESS', seller_orders: [] },
  ], order_items: [{ order_id: 'own-order', seller_user_id: 'seller-a', product_name: 'Shirt', quantity: 1, variant_size: 'M' }] });
  const page = load('app/account/orders/page.tsx', { 'react/jsx-runtime': jsxRuntime, 'next/link': { default: props => React.createElement('a', props) }, '@/lib/auth/require-user': { requireUser: async () => ({ supabase: db, user: { id: 'customer-a' } }) }, '@/lib/fulfilment': fulfilment }).default;
  const html = renderToStaticMarkup(await page());
  for (const value of ['10 Real Road', 'TRACK123', 'DPD', 'Size M', 'Dispatched']) assert.ok(html.includes(value));
  assert.ok(!html.includes('SECRET'));
});
