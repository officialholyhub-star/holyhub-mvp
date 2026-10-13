import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { load, page, query, render, client } from './helpers/render-progress.mjs';

const product = (id, review_status, is_published = false) => ({ id, name: id, review_status, is_published, lister_user_id: 'owner', review_reason: review_status === 'rejected' ? 'Please add a clear cover photo.' : null });
const dependencies = {
  'next/navigation': { redirect(path) { throw new Error(`redirect:${path}`); } },
  'next/headers': { cookies: async () => ({ get: () => undefined }) },
  '@/lib/fulfilment-summary': { getSellerFulfilmentSummary: async () => null },
  '@/app/lister/actions': {}, './actions': {}, '@/components/storefront-form': { StorefrontForm: () => null },
};
function listerClient({ shop = { business_name: 'Shop' }, products = [], shopError = null, productError = null, sales = 0 } = {}) {
  return { from(table) { return query(table === 'lister_storefronts' ? { data: shop, error: shopError } : table === 'products' ? { data: products, error: productError } : { count: sales, data: [] }); } };
}
test('saved shop with no products offers first product regardless of cookie position', async () => {
  for (const cookie of [undefined, '1:later', '2:later', '4:later', '5:later']) {
    const html = await page('app/lister/page.tsx', listerClient(), {}, { ...dependencies, 'next/headers': { cookies: async () => ({ get: () => cookie && { value: cookie } }) } });
    assert.match(html, /Your shop is saved. Add your first product/); assert.match(html, /products\/new\?onboarding=1/);
    assert.doesNotMatch(html, /Continue setup|Finish setting up your shop|accepted/);
  }
});
test('no shop always offers setup even with submitted products or stale cookie', async () => {
  const html = await page('app/lister/page.tsx', listerClient({ shop: null, products: [product('old', 'pending')] }), {}, dependencies);
  assert.match(html, /Continue shop setup/); assert.doesNotMatch(html, /Your shop is saved/);
});
test('returning lister skips completed introductions; active setup handoff remains available', async () => {
  for (const [cookie, products] of [[undefined, []], ['2:later', []], ['3:later', [product('draft', 'draft')]], ['4:later', [product('live', 'approved', true)]]]) {
    await assert.rejects(page('app/lister/onboarding/page.tsx', listerClient({ products }), {}, { ...dependencies, 'next/headers': { cookies: async () => ({ get: () => cookie && { value: cookie } }) } }), /redirect:\/lister$/);
  }
  const handoff = await page('app/lister/onboarding/page.tsx', listerClient(), {}, { ...dependencies, 'next/headers': { cookies: async () => ({ get: () => ({ value: '3:later' }) }) } });
  assert.match(handoff, /Shop saved/); assert.match(handoff, /Continue/);
});
test('success revisits for approved/rejected users never claim a new submission', async () => {
  for (const status of ['approved', 'rejected', 'draft']) {
    await assert.rejects(page('app/lister/onboarding/success/page.tsx', client({ data: [product('product', status)] }), {}, dependencies), /redirect:\/lister\/products/);
  }
  const pending = await page('app/lister/onboarding/success/page.tsx', client({ data: [product('product', 'pending')] }), {}, dependencies);
  assert.match(pending, /awaiting HolyHub review/); assert.doesNotMatch(pending, /first product has been submitted|5 of 5 complete/);
});
test('mixed catalogue surfaces every relevant stage and saved rejection feedback', () => {
  const { ListingStage } = load('components/listing-stage.tsx');
  const html = render(React.createElement(ListingStage, { products: [product('draft', 'draft'), product('waiting', 'pending'), product('returned', 'rejected'), product('hidden', 'approved'), product('live', 'approved', true)] }));
  for (const text of ['saved as drafts', 'Some products are awaiting HolyHub review', 'Please add a clear cover photo', 'Edit product', 'hidden approved products', '1 product is live', 'No resubmission is needed for products awaiting review']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /None of your products are currently live/);
});
test('archive-to-draft guidance does not imply retained approval or automatic publication', () => {
  const { ListingStage } = load('components/listing-stage.tsx');
  const html = render(React.createElement(ListingStage, { products: [product('archived', 'draft')] }));
  assert.match(html, /Archived products also remain here as drafts/); assert.match(html, /submit for HolyHub review/);
  assert.doesNotMatch(html, /approved products are hidden|product is live/);
});
test('unknown sales and failed shop/catalogue reads never become zero or incomplete-shop guidance', async () => {
  const html = await page('app/lister/page.tsx', listerClient({ sales: null, shop: null, shopError: {}, products: null, productError: {} }), {}, dependencies);
  assert.match(html, /Sales count unavailable/); assert.match(html, /Shop details unavailable/); assert.match(html, /Product counts unavailable/);
  assert.doesNotMatch(html, /0 orders received|0 live|Set up your shop|Continue shop setup|Add your first product/);
  const nullCatalogue = await page('app/lister/page.tsx', listerClient({ products: null }), {}, dependencies);
  assert.match(nullCatalogue, /Product counts unavailable/); assert.doesNotMatch(nullCatalogue, /Add your first product/);
});
function adminClient({ failTable = '', nullCounts = false } = {}) {
  const rows = { lister_applications: [{ id: 'a', user_id: 'owner' }], user_roles: [{ user_id: 'other' }], lister_storefronts: [{ user_id: 'owner' }], products: [product('live', 'approved', true)] };
  return { from(table) {
    let countOnly = false; const filters = {};
    const builder = { select(_fields, options) { countOnly = Boolean(options?.head); return this; }, eq(key, value) { filters[key] = value; return this; }, order() { return this; }, range() { return this; }, then(resolve) {
      const counts = table === 'seller_orders' ? (filters.fulfilment_status === 'pending' ? 2 : 3) : table === 'products' ? (filters.review_status === 'rejected' ? 4 : 5) : 1;
      return Promise.resolve(table === failTable ? { data: null, count: null, error: {} } : { data: countOnly ? null : rows[table] ?? [], count: nullCounts ? null : counts, error: null }).then(resolve);
    } }; return builder;
  } };
}
test('admin overview uses recorded portion counts and correct filter destinations', async () => {
  const html = await page('app/admin/page.tsx', adminClient());
  assert.match(html, /6 reviews waiting/); assert.match(html, /status=pending/); assert.match(html, /status=packed/); assert.match(html, /status=rejected/);
  assert.match(html, /<strong>2<\/strong><h2>Needs preparing/); assert.match(html, /<strong>3<\/strong><h2>Processing/);
  assert.match(html, /1 need shop setup · 0 shops have no live products · 1 shops have live products/);
  assert.doesNotMatch(html, /Refunds<\/span>|overdue orders<\/h2>/);
});
test('admin unavailable/null counts and readiness remain distinct from genuine zero', async () => {
  const unknown = await page('app/admin/page.tsx', adminClient({ nullCounts: true, failTable: 'lister_storefronts' }));
  assert.match(unknown, /Review counts unavailable/); assert.match(unknown, /Readiness could not be loaded/); assert.doesNotMatch(unknown, /0 reviews waiting|<strong>0<\/strong>/);
  const zero = await page('app/admin/page.tsx', client({ data: [], count: 0, error: null }));
  assert.match(zero, /0 reviews waiting/); assert.match(zero, /<strong>0<\/strong>/); assert.doesNotMatch(zero, /Unavailable/);
});
test('readiness preserves equal-named accounts and ignores products from unrelated accounts', () => {
  const { listerReadiness } = load('lib/admin-listers.ts');
  const result = listerReadiness([{ user_id: 'a' }], [{ user_id: 'a' }, { user_id: 'b' }], [{ user_id: 'a', business_name: 'Same' }, { user_id: 'b', business_name: 'Same' }], [{ lister_user_id: 'a', review_status: 'approved', is_published: true }, { lister_user_id: 'unrelated', review_status: 'approved', is_published: true }]);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { total: 2, setupNeeded: 0, live: 1, notLive: 1 });
});
test('admin returned queue displays saved feedback and friendly read-only status', async () => {
  const html = await page('app/admin/products/page.tsx', { from: table => query({ data: table === 'products' ? [{ ...product('returned', 'rejected'), description: 'Description', category_type: 'Books', price: 10, created_at: '2026-10-01' }] : [{ user_id: 'owner', business_name: 'Shop' }] }) }, { status: 'rejected' }, { '@/app/admin/actions': {} });
  assert.match(html, /Returned products/); assert.match(html, /Please add a clear cover photo/); assert.match(html, /Changes requested/);
  assert.doesNotMatch(html, /name="decision"/);
});
test('ordinary success-page revisits preserve a newer draft; confirmed-save return cleans the saved draft', async () => {
  const deps = { ...dependencies, '@/components/draft-form': { ClearDraft: () => React.createElement('p', null, 'CLEAR SAVED DRAFT') } };
  const supabase = client({ data: [product('pending', 'pending')] });
  const revisit = await page('app/lister/onboarding/success/page.tsx', supabase, {}, deps);
  assert.doesNotMatch(revisit, /CLEAR SAVED DRAFT/);
  const saved = await page('app/lister/onboarding/success/page.tsx', supabase, { saved: 'new' }, deps);
  assert.match(saved, /CLEAR SAVED DRAFT/);
  await assert.rejects(page('app/lister/onboarding/success/page.tsx', client({ data: [] }), { saved: 'new' }, deps), /redirect:\/lister\/products\?saved=new/);
});
