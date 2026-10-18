import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const link = { default: ({ children, ...props }) => React.createElement('a', props, children), __esModule: true };
function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, console: { error() {} }, process: { env: {} }, URL, URLSearchParams, FormData, Date, setTimeout, clearTimeout, ...globals, require: name => {
    if (name in dependencies) return dependencies[name];
    if (name === 'server-only') return {};
    if (name === 'next/link') return link;
    if (name.endsWith('.css')) return { default: {}, __esModule: true };
    if (name.startsWith('@/')) { const base = name.slice(2); return load(fs.existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.ts`, dependencies, globals); }
    if (name.startsWith('.')) { const base = path.resolve(path.dirname(file), name); return load(fs.existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.ts`, dependencies, globals); }
    return require(name);
  } }, { filename: file });
  return exports;
}
function query(result) {
  return new Proxy({ then(resolve) { return Promise.resolve(result).then(resolve); } }, { get(target, key) { return key in target ? target[key] : () => query(result); } });
}
const render = element => renderToStaticMarkup(element);
const role = supabase => ({ requireRole: async () => ({ supabase, user: { id: 'owner' } }) });
const client = result => ({ from: () => query(result), rpc: async () => ({ data: [], error: null }), auth: { getUser: async () => ({ data: { user: null } }) } });
async function page(file, supabase, params = {}, dependencies = {}) {
  return render(await load(file, { '@/lib/auth/require-user': role(supabase), '@/lib/supabase/server': { createClient: async () => supabase }, ...dependencies }).default({ searchParams: Promise.resolve(params), params: Promise.resolve({ id: 'shop' }) }));
}
const image = { default: props => React.createElement('img', props), __esModule: true };
test('marketplace distinguishes empty catalogue, search/category/price results and failed loads', async () => {
  const dependencies = { 'next/image': image, '@/lib/favourites': { getFavouriteIds: async () => [] }, '@/components/add-to-basket-button': {}, '@/components/favourite-button': {} };
  for (const params of [{}, { q: 'absent' }, { category: 'Books' }, { min: '5' }]) {
    const html = await page('app/marketplace/page.tsx', client({ data: [], error: null }), params, dependencies);
    if (!Object.keys(params).length) { assert.match(html, /Products are coming soon/); assert.doesNotMatch(html, /No products found/); }
    else { assert.match(html, /No products found/); assert.match(html, /View all products/); assert.doesNotMatch(html, /Products are coming soon/); }
  }
  const html = await page('app/marketplace/page.tsx', client({ data: null, error: { message: 'private' } }), {}, dependencies);
  assert.doesNotMatch(html, /Products are coming soon|No products found|private/);
});
test('public empty shop offers marketplace action; shop product failure stays an error', async () => {
  for (const failed of [false, true]) {
    const supabase = { from: table => query(table === 'lister_storefronts' ? { data: { business_name: 'Shop', category_type: 'Books' } } : { data: [], error: failed ? {} : null }) };
    const html = await page('app/lister/storefront/[id]/page.tsx', supabase, {}, { 'next/image': image, 'next/navigation': { notFound() { throw Error('404'); } } });
    assert.match(html, failed ? /couldn’t load this shop/ : /Browse marketplace/);
    if (failed) assert.doesNotMatch(html, /no products available/);
  }
});
test('catalogue stages offer appropriate next steps', () => {
  const { ListingStage } = load('components/listing-stage.tsx');
  for (const [review_status, is_published, title, action] of [
    ['draft', false, 'Your first product is saved as a draft', 'Finish your product'],
    ['pending', false, 'awaiting HolyHub review', 'View submitted products'],
    ['approved', false, 'None of your products are currently live', 'Review hidden products'],
  ]) {
    const html = render(React.createElement(ListingStage, { products: [{ id: 'listing', review_status, is_published }] }));
    assert.match(html, new RegExp(title)); assert.match(html, new RegExp(action));
    if (review_status === 'pending') assert.match(html, /No resubmission is needed/);
  }
  assert.equal(render(React.createElement(ListingStage, { products: [] })), '');
  assert.match(render(React.createElement(ListingStage, { products: [{ id: 'listing', review_status: 'approved', is_published: true }] })), /1 product is live/);
});
test('lister no-orders state hides exports and points to products', async () => {
  const html = await page('app/lister/orders/page.tsx', client({ data: [], error: null }), {}, {
    '@/lib/fulfilment-summary': { getSellerFulfilmentSummary: async () => null },
    '@/lib/supabase/admin': { createAdminClient: () => client({ data: [] }) },
    './actions': { updateSellerFulfilment() {} }, '@/components/order-update-panel': {},
  });
  assert.match(html, /No orders yet/); assert.match(html, /Paid orders will appear here/); assert.match(html, /View your products/);
  assert.doesNotMatch(html, /Export unfulfilled|Select orders/);
});
test('nothing waiting keeps dispatched and completed counts without all-caught-up wording', () => {
  const { FulfilmentSummary } = load('components/fulfilment-summary.tsx');
  const html = render(React.createElement(FulfilmentSummary, { summary: { toFulfil: 0, processing: 0, dispatched: 2, completed: 3 } }));
  assert.match(html, /No orders waiting to be prepared or sent/); assert.match(html, /Dispatched/); assert.match(html, /Completed/); assert.doesNotMatch(html, /all caught up/);
});
test('all-invalid bulk preview gives correction guidance instead of empty valid list heading', () => {
  const react = { ...React, useState: initial => [initial, () => {}], useActionState: () => [{ rows: [{ row: 2, errors: ['Name is required'], warnings: [] }] }, () => {}, false] };
  const { BulkProductUpload } = load('components/bulk-product-upload.tsx', { react, '@/app/lister/products/bulk/actions': {} });
  const html = render(React.createElement(BulkProductUpload));
  assert.match(html, /No products are ready to import/); assert.match(html, /upload your corrected CSV/); assert.doesNotMatch(html, /<h3>Valid rows/);
});
test('admin orders distinguish genuinely empty, filters, pagination and failure', async () => {
  for (const [params, expected] of [[{}, /No orders yet/], [{ status: 'packed' }, /No orders match these filters/], [{ page: '4', status: 'packed' }, /Return to first page/]]) {
    const html = await page('app/admin/orders/page.tsx', client({ data: [], count: 0 }), params);
    assert.match(html, expected);
    if (params.page) assert.match(html, /status=packed.*page=1/);
  }
  const html = await page('app/admin/orders/page.tsx', client({ data: null, error: {} }));
  assert.match(html, /Orders could not be loaded/); assert.doesNotMatch(html, /No orders yet|No orders match/);
});
test('admin empty lister directory provides review applications action', async () => {
  const html = await page('app/admin/listers/page.tsx', client({ data: [], error: null }));
  assert.match(html, /No approved listers yet/); assert.match(html, /Review applications/);
});
test('admin missing product links back to queue; failed counts never say zero waiting', async () => {
  const dependencies = { '@/components/admin-product-review-card': {} };
  const missing = await page('app/admin/products/page.tsx', client({ data: [] }), { product: '11111111-1111-4111-8111-111111111111' }, dependencies);
  assert.match(missing, /This listing is no longer available/); assert.match(missing, /Return to product review queue/); assert.doesNotMatch(missing, /New submissions will appear/);
  for (const file of ['app/admin/products/page.tsx', 'app/admin/applications/page.tsx']) {
    const html = await page(file, client({ data: null, error: {} }), {}, dependencies);
    assert.match(html, /Count unavailable/); assert.doesNotMatch(html, /0 waiting/);
  }
});
test('admin shop lookup failure stays unavailable and does not render fallback identity or review controls', async () => {
  const supabase = { from: table => query(table === 'products' ? { data: [{ id: 'listing', lister_user_id: 'owner' }] } : { data: null, error: {} }) };
  const html = await page('app/admin/products/page.tsx', supabase, {}, { '@/components/admin-product-review-card': { AdminProductReviewCard: () => React.createElement('p', null, 'REVIEW CONTROLS') } });
  assert.match(html, /Shop details could not be loaded/); assert.match(html, /Refresh/);
  assert.doesNotMatch(html, /REVIEW CONTROLS|no longer available|No product listings/);
});
test('dashboard shows saved draft guidance and suppresses it after catalogue failure', async () => {
  for (const failed of [false, true]) {
    const supabase = { from: table => query(table === 'lister_storefronts' ? { data: { business_name: 'Shop' } } : { data: failed ? null : [{ id: 'draft', review_status: 'draft', is_published: false }], count: 0, error: failed ? {} : null }) };
    const html = await page('app/lister/page.tsx', supabase, {}, { 'next/headers': { cookies: async () => ({ get() {} }) }, '@/lib/fulfilment-summary': { getSellerFulfilmentSummary: async () => null } });
    if (failed) { assert.match(html, /could not be loaded/); assert.doesNotMatch(html, /first product is saved|Finish setting up your shop/); }
    else { assert.match(html, /Your first product is saved as a draft/); assert.doesNotMatch(html, /Continue setup/); }
  }
});
test('storefront first-time intent never replaces a load failure', async () => {
  const dependencies = { '@/app/lister/actions': {}, '@/components/storefront-form': { StorefrontForm: () => React.createElement('form') } };
  const empty = await page('app/lister/storefront/page.tsx', client({ data: null }), {}, dependencies);
  assert.match(empty, /Set up your shop/); assert.match(empty, /delivery details/);
  const failed = await page('app/lister/storefront/page.tsx', client({ data: null, error: {} }), {}, dependencies);
  assert.doesNotMatch(failed, /<form|Set up your shop/); assert.match(failed, /couldn’t load/);
});
test('dispatched purchases without tracking explain its absence; tracked portions retain their link', async () => {
  for (const tracking_url of [null, 'https://example.com/tracking']) {
    const supabase = { from: table => query({ data: table === 'orders' ? [{ id: 'order', total_amount: 1200, order_status: 'paid', created_at: '2026-10-01', seller_orders: [{ id: 'portion', seller_user_id: 'seller', seller_business_name: 'Shop', fulfilment_status: 'dispatched', tracking_url }] }] : [] }) };
    const html = await page('app/account/orders/page.tsx', supabase, {}, { '@/lib/auth/require-user': { requireUser: async () => ({ supabase, user: { id: 'customer' } }) } });
    if (tracking_url) { assert.match(html, /Track your order/); assert.doesNotMatch(html, /No tracking details have been added/); }
    else assert.match(html, /No tracking details have been added/);
  }
});
