import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import ts from 'typescript';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
function loadPage(file, dependencies) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, require: name => name in dependencies ? dependencies[name] : loadTypescript(`${name.slice(2)}.ts`), URLSearchParams, console });
  return exports;
}
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTypescript } from './helpers/load-typescript.mjs';
function setup(authorized = true) {
  const order = '11111111-1111-4111-8111-111111111111';
  const lister = '22222222-2222-4222-8222-222222222222';
  const calls = [];
  const supabase = { from(table) {
    calls.push({ table });
    const call = calls.at(-1);
    const query = {
      select() { return this; }, order() { return this; },
      eq(key, value) { (call.filters ??= {})[key] = value; return this; },
      in() { return this; }, range(start, end) { call.range = [start, end]; return this; },
      then(resolve) { resolve(table === 'seller_orders' ? { data: [{ id: 'portion', order_id: order, seller_user_id: lister, seller_business_name: 'Shop', total_amount: 1200, seller_amount: 950, holyhub_commission: 50, order_status: 'paid', fulfilment_status: 'packed', created_at: '2026-10-01', updated_at: '2026-10-02', orders: { order_status: 'paid', delivery_recipient_name: 'Customer' } }], count: 51 } : { data: [{ order_id: order, seller_user_id: lister, product_name: 'Own product', quantity: 1, line_total: 1000 }, { order_id: order, seller_user_id: 'other', product_name: 'OTHER PORTION', quantity: 1, line_total: 999 }] }); },
    }; return query;
  }};
  const { default: Page } = loadPage('app/admin/orders/page.tsx', {
    'react/jsx-runtime': jsx,
    'next/link': props => React.createElement('a', props),
    '@/lib/auth/require-user': { requireRole: async role => { assert.equal(role, 'admin'); if (!authorized) throw new Error('Denied'); return { supabase }; } },
  });
  return { Page, calls, order, lister };
}
test('admin orders enforce role before any data access', async () => {
  const { Page, calls } = setup(false);
  await assert.rejects(Page({ searchParams: Promise.resolve({}) }), /Denied/);
  assert.equal(calls.length, 0);
});
test('admin order portions retain text statuses, item boundaries and filtered pagination', async () => {
  const { Page, calls, lister } = setup();
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ status: 'packed', lister }) }));
  assert.match(html, /Processing/);
  assert.match(html, /order-tone-progress/);
  assert.match(html, /Own product/);
  assert.doesNotMatch(html, /OTHER PORTION/);
  assert.match(html, /Cancelled does not confirm a refund/);
  assert.match(html, /page=2/);
  assert.equal(calls[0].filters.seller_user_id, lister);
  assert.equal(calls[0].filters.fulfilment_status, 'packed');
  assert.deepEqual(calls[0].range, [0, 49]);
});
