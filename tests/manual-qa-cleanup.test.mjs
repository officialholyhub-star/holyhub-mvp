import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTypescript } from './helpers/load-typescript.mjs';
import { renderAccount } from './helpers/render-account.mjs';
const { adminListerDirectory, catalogueCounts } = loadTypescript('lib/admin-listers.ts');
const { basketItemIssue, reviewBasketItem, basketReviewLabel } = loadTypescript('lib/basket-availability.ts');
const item = { id: 'product', name: 'Book marks', price: 10, currency: 'GBP', listerId: 'seller', listerName: 'Shop', quantity: 2, deliveryOption: 'free', deliveryCharge: 0 };
const product = { id: 'product', name: 'Book marks', price: 10, currency: 'GBP', category_type: 'Bookmarks', stock_quantity: 5, product_variants: [], lister_storefronts: { delivery_option: 'free', delivery_charge: 0, delivery_country: 'GB' } };
function ui(file, dependencies, context = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, require: name => name === '@/components/draft-form' ? { DraftForm: 'form', ClearDraft: () => null } : name === 'react/jsx-runtime' ? jsx : name in dependencies ? dependencies[name] : loadTypescript(`${name.slice(2)}.ts`), console, Map, Set, ...context });
  return exports;
}
test('directory includes role-enabled listers without applications and never merges equal shop names', () => {
  const applications = [{ id: 'application', user_id: 'one', business_name: 'Same shop', status: 'approved' }];
  const shops = [{ user_id: 'one', business_name: 'Same shop' }, { user_id: 'fourteen', business_name: 'Same shop' }];
  const rows = adminListerDirectory(applications, shops, [{ user_id: 'one' }, { user_id: 'fourteen' }]);
  assert.equal(rows.length, 2);
  assert.equal(rows.find(r => r.user_id === 'fourteen').hasApplication, false);
  assert.equal(rows.find(r => r.user_id === 'one').hasApplication, true);
  const products = [...Array(8).fill({ review_status: 'approved', is_published: true }), ...Array(6).fill({ review_status: 'draft', is_published: false })];
  assert.deepEqual(JSON.parse(JSON.stringify(catalogueCounts(products))), { total: 14, live: 8, pending: 0 });
  products.push({ review_status: 'approved', is_published: false }, { review_status: 'pending', is_published: true }, { review_status: 'rejected', is_published: false });
  assert.deepEqual(JSON.parse(JSON.stringify(catalogueCounts(products))), { total: 17, live: 8, pending: 1 });
});
test('actual admin page includes full 14-product role-only catalogue, preserving separate one-product account', async () => {
  const data = {
    lister_applications: [{ id: 'a', user_id: 'one', business_name: 'Same shop', status: 'approved', category_type: 'Books' }],
    lister_storefronts: ['one', 'fourteen'].map(user_id => ({ user_id, business_name: 'Same shop', category_type: 'Books', delivery_charge: 0 })),
    products: [{ id: 'one', lister_user_id: 'one', name: 'Other account', review_status: 'approved', is_published: true }, ...Array.from({ length: 14 }, (_, i) => ({ id: `p${i}`, name: `Own product ${i}`, lister_user_id: 'fourteen', review_status: i < 8 ? 'approved' : 'draft', is_published: i < 8, stock_quantity: 3 }))],
    seller_orders: [], user_roles: [{ user_id: 'one' }, { user_id: 'fourteen' }],
  };
  const supabase = { from: table => { const q = { select() { return q; }, eq() { return q; }, in() { return q; }, order() { return q; }, range() { return q; }, then(resolve) { resolve({ data: data[table], error: null }); } }; return q; } };
  const { default: Page } = ui('app/admin/listers/page.tsx', {
    '@/lib/auth/require-user': { requireRole: async role => { assert.equal(role, 'admin'); return { supabase }; } },
    'next/link': props => React.createElement('a', props), '@/components/lister-onboarding.module.css': {},
  });
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  assert.match(html, /14 products · 8 live · 0 awaiting review/);
  assert.match(html, /1 product · 1 live/);
  assert.match(html, /Own product 13/);
  assert.match(html, /Application &amp; contact/);
  assert.doesNotMatch(html, /Last active/);
});
test('basket identifies specific unavailable, stock, size, price and delivery problems', () => {
  assert.equal(basketItemIssue(item, [product]), null);
  assert.match(basketItemIssue(item, []), /Book marks is no longer available/);
  assert.match(basketItemIssue(item, [{ ...product, stock_quantity: 0 }]), /Book marks is now out of stock/);
  assert.match(basketItemIssue(item, [{ ...product, stock_quantity: 1 }]), /Only 1 available. Your basket currently has 2/);
  assert.match(basketItemIssue(item, [{ ...product, price: 12 }]), /from £10.00 to £12.00/);
  assert.match(basketItemIssue({ ...item, variantId: 'missing', variantSize: 'M' }, [product]), /selected size/);
  assert.match(basketItemIssue(item, [{ ...product, lister_storefronts: null }]), /Delivery.*unavailable/);
  assert.match(basketItemIssue(item, [{ ...product, lister_storefronts: { delivery_option: 'flat', delivery_charge: 2.99, delivery_country: 'GB' } }]), /£2.99 per seller order/);
  const revised = reviewBasketItem(item, { ...product, price: 12, stock_quantity: 1 });
  assert.equal(basketReviewLabel(item, { ...product, stock_quantity: 1 }), "Update to 1");
  assert.equal(revised.price, 12); assert.equal(revised.quantity, 1); assert.equal(item.price, 10);
  assert.equal(reviewBasketItem(item, { ...product, stock_quantity: 0 }), null);
});
test('marketplace hides quantity controls while product-page default and stock guard remain', () => {
  const { AddToBasketButton } = ui('components/add-to-basket-button.tsx', { react: React });
  const card = renderToStaticMarkup(React.createElement(AddToBasketButton, { ...item, stockQuantity: 5, showQuantity: false }));
  assert.doesNotMatch(card, /Increase quantity|Decrease quantity/); assert.match(card, /Add to basket/);
  const detail = renderToStaticMarkup(React.createElement(AddToBasketButton, { ...item, stockQuantity: 5 }));
  assert.match(detail, /Increase quantity/);
  const out = renderToStaticMarkup(React.createElement(AddToBasketButton, { ...item, stockQuantity: 0, showQuantity: false }));
  assert.match(out, /disabled=""[^>]*>Out of stock/);
  const sizesOut = renderToStaticMarkup(React.createElement(AddToBasketButton, { ...item, stockQuantity: 5, showQuantity: false, variants: [{ id: 'm', size: 'M', stock_quantity: 0 }] }));
  assert.match(sizesOut, /disabled=""[^>]*>Out of stock/);
});
test('account management request is clearly separated and honestly labelled', async () => {
  const { html } = await renderAccount();
  assert.match(html, /aria-labelledby="account-management-heading"/);
  assert.match(html, /class="button button-secondary" href="\/account\/delete"/);
  assert.match(html, /Your account stays active until deletion is completed/);
});
test('listing allowance wording is correct below, at and above ten', async () => {
  for (const [count, expected] of [[0, /0 of your 10 free listings used · 10 remaining/], [9, /9 of your 10 free listings used · 1 remaining/], [10, /Your 10 free listings are used/], [11, /1 listing is beyond/], [14, /4 listings are beyond/]]) {
    const supabase = { from() { const q = { select() { return q; }, eq() { return q; }, order() { return q; }, then(resolve) { resolve({ data: [], count }); } }; return q; } };
    const { default: Page } = ui('app/lister/products/page.tsx', { 'next/link': props => React.createElement('a', props), '@/lib/auth/require-user': { requireRole: async () => ({ supabase, user: { id: 'seller' } }) }, '@/app/lister/actions': { deleteProduct() {} }, '@/components/help-icon': { HelpIcon() { return null; } }, '@/components/listing-stage': { ListingStage() { return null; } } });
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    assert.match(html, expected); assert.match(html, /Additional listings are £0.20 each; billing is not enabled/);
  }
});

test('delete-account confirmation is explicit and honestly opens email rather than deleting', async () => {
  const { default: Page } = ui('app/account/delete/page.tsx', {
    '@/lib/auth/require-user': { requireUser: async () => ({ user: { id: 'account-test' } }) },
    '@/components/account-deletion-request': { AccountDeletionRequest: () => null },
  });
  const html = renderToStaticMarkup(await Page());
  assert.match(html, /<h1>Delete account<\/h1>/);
  assert.match(html, /Historical completed orders alone do not prevent account closure/);
  assert.match(html, /unresolved orders, payouts, refunds/);
  assert.match(html, /tax, legal or other records/);
  for (const [confirmation, acknowledged, shouldOpen] of [['', false, false], ['DELETE', false, false], ['wrong', true, false], ['DELETE', true, true]]) {
    const values = [confirmation, acknowledged, false]; let index = 0;
    const location = { href: '' };
    const { AccountDeletionRequest } = ui('components/account-deletion-request.tsx', {
      react: { useState: () => [values[index++], () => {}] },
      'next/link': props => React.createElement('a', props),
    }, { window: { location } });
    const form = AccountDeletionRequest({ accountId: 'account-test' });
    const markup = renderToStaticMarkup(form);
    assert.match(markup, /Are you sure/);
    assert.match(markup, /does not delete your account immediately/);
    assert.match(markup, /href="\/account">Cancel/);
    form.props.onSubmit({ preventDefault() {} });
    assert.equal(Boolean(location.href), shouldOpen);
    if (shouldOpen) {
      assert.match(location.href, /^mailto:/);
      assert.match(decodeURIComponent(location.href), /Please permanently close my HolyHub account/);
      assert.match(decodeURIComponent(location.href), /Account reference: account-test/);
    }
  }
});
