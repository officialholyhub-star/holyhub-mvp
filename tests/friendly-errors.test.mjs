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
const redirect = value => { throw new Error(`REDIRECT:${value}`); };
function query(result) { return { range() { return this; }, select() { return this; }, eq() { return this; }, in() { return this; }, order() { return this; }, maybeSingle: async () => result, then(resolve) { return Promise.resolve(result).then(resolve); } }; }
async function payment(status, { error = null, stripePaid = false, rpcError = null } = {}) {
  let reads = 0; const rpcCalls = []; let retrieves = 0;
  const client = { from: () => query({ get data() { reads++; return status === null ? null : { status: reads > 1 && stripePaid && !rpcError ? 'paid' : status, amount_total: 1000, currency: 'GBP' }; }, error }) };
  const Page = load('app/checkout/success/page.tsx', {
    '@/lib/auth/require-user': { requireUser: async () => ({ supabase: client, user: { id: 'customer' } }) },
    '@/lib/supabase/admin': { createAdminClient: () => ({ rpc: async (...args) => { rpcCalls.push(args); return { error: rpcError }; } }) },
    '@/lib/stripe': { getStripe: () => ({ checkout: { sessions: { retrieve: async () => { retrieves++; return { id: 'cs_fixture', payment_status: stripePaid ? 'paid' : 'unpaid', amount_total: 1000, currency: 'gbp' }; } } } }) },
  }).default;
  return { html: renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ session_id: 'cs_fixture' }) })), rpcCalls, retrieves };
}
test('payment presentation separates confirmed, pending, failed, cancelled and unavailable without changing processing', async () => {
  for (const status of ['pending', 'failed', 'cancelled', null]) {
    const result = await payment(status);
    assert.doesNotMatch(result.html, /Thank you for your payment|Your payment has been confirmed/);
    assert.match(result.html, /Check My Purchases/);
    assert.equal(result.rpcCalls.length, 0);
    if (status === 'pending' || status === null) assert.doesNotMatch(result.html, /Return to basket/);
  }
  const confirmed = await payment('paid');
  assert.match(confirmed.html, /Thank you for your payment/);
  assert.match(confirmed.html, /Your payment has been confirmed/);
  assert.equal(confirmed.retrieves, 0);
  const failedRead = await payment('paid', { error: { message: 'PRIVATE DATABASE DETAILS' } });
  assert.doesNotMatch(failedRead.html, /Thank you|PRIVATE DATABASE/);
  const recovered = await payment('pending', { stripePaid: true });
  assert.match(recovered.html, /Your payment has been confirmed/);
  assert.equal(recovered.rpcCalls.length, 1);
  assert.equal(recovered.rpcCalls[0][0], 'process_checkout_payment');
  const uncertain = await payment('pending', { stripePaid: true, rpcError: { code: 'fixture' } });
  assert.doesNotMatch(uncertain.html, /Thank you|Your payment has been confirmed|Return to basket/);
});
test('admin product zero-row and failed updates never report success or clean snapshots', async () => {
  for (const result of [{ data: null, error: null }, { data: null, error: { message: 'private' } }, { data: { id: 'product' }, error: null }]) {
    const tables = [];
    const action = load('app/admin/actions.ts', {
      'next/navigation': { redirect }, 'next/cache': { revalidatePath() {} },
      '@/lib/auth/require-user': { requireRole: async () => ({}) },
      '@/lib/supabase/admin': { createAdminClient: () => ({ from(table) { tables.push(table); return { ...query(result), update() { return this; }, delete() { return this; } }; } }) },
    }).reviewProductListing;
    const form = new FormData(); form.set('product_id', 'product'); form.set('decision', 'approve'); form.set('product_version', '2026-10-12T00:00:00Z');
    if (!result.data) { await assert.rejects(action(form), /could%20not%20confirm/); assert.deepEqual(tables, ['products']); }
    else { await assert.rejects(action(form), /Listing%20approved/); assert.deepEqual(tables, ['products', 'product_review_snapshots']); }
  }
});
test('failed storefront load cannot render an editable settings form', async () => {
  const Page = load('app/lister/storefront/page.tsx', { '@/lib/auth/require-user': { requireRole: async () => ({ user: { id: 'lister' }, supabase: { from: () => query({ data: null, error: { message: 'private' } }) } }) }, '@/app/lister/actions': { saveStorefront() {} } }).default;
  const html = renderToStaticMarkup(await Page());
  assert.match(html, /couldn’t load|couldn&#x27;t load/i); assert.match(html, /Try again/); assert.doesNotMatch(html, /<form|name="business_name"|private/);
});
test('failed catalogue/count queries are unavailable, never an empty catalogue or zero waiting', async () => {
  const dependencies = { '@/lib/auth/require-user': { requireRole: async () => ({ user: { id: 'lister' }, supabase: { from: () => query({ data: null, count: null, error: { message: 'private' } }) } }) }, '@/app/lister/actions': { deleteProduct() {} } };
  const catalogue = load('app/lister/products/page.tsx', dependencies).default;
  const html = renderToStaticMarkup(await catalogue({ searchParams: Promise.resolve({}) }));
  assert.match(html, /could not be loaded/); assert.doesNotMatch(html, /haven.*created any listings|0 of your 10/);
  const admin = load('app/admin/page.tsx', dependencies).default;
  const adminHtml = renderToStaticMarkup(await admin());
  assert.match(adminHtml, /counts unavailable/); assert.doesNotMatch(adminHtml, /No listings waiting|No applications waiting|0 items waiting/);
});
test('draft storage preserves editable values and excludes credentials, confirmations and internal identifiers', () => {
  const memory = new Map(); const sessionStorage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const drafts = load('lib/form-drafts.ts', {}, { sessionStorage });
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: 'Unsaved product', stock_quantity: '7', image_urls: 'https://fixture/image.jpg', password: 'secret', product_id: 'internal', accept_terms: 'on', confirmed: 'yes', tracking_number: 'TRACK' })) form.append(key, value);
  drafts.writeDraft('owner-product', drafts.editableDraft(form));
  const restored = JSON.parse(JSON.stringify(drafts.readDraft('owner-product')));
  assert.deepEqual(restored, { name: ['Unsaved product'], stock_quantity: ['7'], image_urls: ['https://fixture/image.jpg'], tracking_number: ['TRACK'] });
  assert.equal(drafts.readDraft('other-owner'), null);
  memory.set('hh-product-draft-owner', JSON.stringify({ name: 'Earlier draft', images: ['https://fixture/earlier.jpg'], password: 'never restore' }));
  assert.deepEqual(JSON.parse(JSON.stringify(drafts.readDraft('hh-product-draft-owner-new'))), { name: ['Earlier draft'], images: ['https://fixture/earlier.jpg'] });
  assert.ok(memory.has('hh-product-draft-owner'), 'reading a legacy draft must not delete it');
  memory.set('expired', JSON.stringify({ at: 0, values: { name: ['old'] } })); assert.equal(drafts.readDraft('expired'), null);
});
test('route/global fallbacks never render exception text and offer retry/navigation', () => {
  for (const file of ['app/error.tsx', 'app/global-error.tsx']) {
    const Page = load(file).default;
    const html = renderToStaticMarkup(React.createElement(Page, { error: new Error('SECRET STACK DATABASE'), retry() {} }));
    assert.match(html, /Try again/); assert.match(html, /Contact HolyHub/); assert.doesNotMatch(html, /SECRET|STACK|DATABASE/);
  }
  assert.match(renderToStaticMarkup(React.createElement(load('app/not-found.tsx').default)), /Browse marketplace/);
});
test('temporary auth lookup failures do not mark accounts blocked or permissions denied', async () => {
  const supabase = { auth: { getUser: async () => ({ data: { user: { id: 'customer' } }, error: null }) }, from: () => query({ data: null, error: { message: 'private' } }) };
  const auth = load('lib/auth/require-user.ts', { 'next/navigation': { redirect }, '@/lib/supabase/server': { createClient: async () => supabase } });
  await assert.rejects(auth.requireUser(), error => /could not be verified/.test(error.message) && !/REDIRECT|blocked|private/.test(error.message));
});

test('login preserves safe return paths, rejects external redirects and gives resend guidance', async () => {
  for (const [next, destination] of [['/lister/orders?view=all', '/lister/orders?view=all'], ['https://evil.example', '/account'], ['//evil.example', '/account'], ['/auth/login', '/account']]) {
    const actions = load('app/auth/actions.ts', {
      'next/navigation': { redirect }, 'next/cache': { revalidatePath() {} }, 'next/headers': { headers: async () => new Headers() },
      '@/lib/supabase/server': { createClient: async () => ({ auth: { signInWithPassword: async () => ({ error: null }) } }) },
    });
    const data = new FormData(); data.set('email', 'fixture@example.test'); data.set('password', 'fixture-password'); data.set('next', next);
    await assert.rejects(actions.login(data), error => error.message === `REDIRECT:${destination}`);
  }
  const actions = load('app/auth/actions.ts', {
    'next/navigation': { redirect }, 'next/cache': { revalidatePath() {} },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { signInWithPassword: async () => ({ error: { code: 'email_not_confirmed', message: 'private' } }) } }) },
  });
  const data = new FormData(); data.set('email', 'fixture@example.test'); data.set('password', 'fixture-password'); data.set('next', '/basket');
  await assert.rejects(actions.login(data), error => /Confirm%20your%20email/.test(error.message) && /next=%2Fbasket/.test(error.message) && !/private/.test(error.message));
  const Login = load('app/auth/login/page.tsx', { '@/app/auth/actions': { login() {} } }).default;
  const html = renderToStaticMarkup(await Login({ searchParams: Promise.resolve({ next: '/basket' }) }));
  assert.match(html, /Resend confirmation email/); assert.match(html, /name="next" value="\/basket"/);
});

test('failed product action retains text, stock, category and successful image uploads through reset', async () => {
  const memory = new Map();
  const sessionStorage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const drafts = load('lib/form-drafts.ts', {}, { sessionStorage });
  const slots = []; let cursor = 0;
  const hooks = { useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; }, useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; }, useEffect() {} };
  class FixtureFormData extends FormData { constructor(form) { super(); if (form) for (const [key, values] of Object.entries(form.fields)) for (const value of values) this.append(key, value); } }
  const props = { userId: 'owner', guided: true, action: async () => { throw new Error('Save not confirmed'); } };
  const Product = load('components/product-form.tsx', { react: hooks, 'react-dom': { useFormStatus: () => ({ pending: false }) }, '@/components/draft-form': { FormRecovery: 'recovery' }, '@/lib/form-drafts': drafts, '@/components/product-image-uploader': { ProductImageUploader: 'uploader' } }, { FormData: FixtureFormData, sessionStorage }).ProductForm;
  function walk(tree, predicate) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(child => walk(child, predicate)); return [...(predicate(tree) ? [tree] : []), ...walk(tree.props?.children, predicate)]; }
  function render() { cursor = 0; return Product(props); }
  let tree = render();
  const form = walk(tree, node => node.type === 'form')[0];
  const controls = [{ name: 'name', type: 'text', value: '' }, { name: 'stock_quantity', type: 'number', value: '' }];
  const fields = { name: ['My unsaved item'], description: ['Handmade'], category_type: ['Books'], price: ['12.50'], stock_quantity: ['7'], gallery_present: ['1'], image_urls: ['https://fixture/upload.jpg'] };
  form.props.ref.current = { fields, querySelectorAll: () => controls };
  // Draft recovery is also used after failed edit/non-guided submissions.
  props.guided = false; tree = render();
  walk(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  await assert.rejects(props.action(new FixtureFormData(form.props.ref.current)), /not confirmed/);
  assert.ok(memory.has('hh-product-draft-owner-new'));
  walk(tree, node => node.type === 'recovery')[0].props.onSettled();
  assert.equal(controls[0].value, 'My unsaved item'); assert.equal(controls[1].value, '7');
  tree = render();
  assert.equal(walk(tree, node => node.type === 'select')[0].props.value, 'Books');
  assert.equal(walk(tree, node => node.type === 'uploader')[0].props.initialImages[0].image_url, 'https://fixture/upload.jpg');
  assert.ok(memory.has('hh-product-draft-owner-new'), 'a failed submission must not clear the draft');
});

function clientHooks() {
  const slots = []; let cursor = 0;
  return { hooks: { useId: () => 'fixture', useEffect() {}, useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; }, useTransition: () => [false, callback => callback()] }, render(Component, props) { cursor = 0; return Component(props); } };
}
function nodes(tree, predicate) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate)); return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]; }
function textContent(tree) { if (tree === null || tree === undefined || typeof tree === 'boolean') return ''; if (typeof tree !== 'object') return String(tree); if (Array.isArray(tree)) return tree.map(textContent).join(' '); return textContent(tree.props?.children); }

test('tracking save failure retains edits and gives refresh/check guidance', async () => {
  const client = clientHooks(); const saved = [];
  const Panel = load('components/order-update-panel.tsx', {
    react: client.hooks, 'react-dom': { useFormStatus: () => ({ pending: false }) },
    'next/navigation': { unstable_rethrow() {} }, '@/lib/form-drafts': { readDraft: () => null, writeDraft: (...args) => saved.push(args) },
    './order-cancellation': { OrderCancellation: 'cancellation-fixture' },
  }).OrderUpdatePanel;
  const props = { order: { id: 'portion', fulfilment_status: 'dispatched', carrier: null, carrier_other: null, tracking_number: null, tracking_url: null, fulfilment_note: null }, action: async () => { throw new Error('PRIVATE NETWORK DETAILS'); }, deliveryAddress: 'Fixture address', draftOwner: 'owner' };
  let tree = client.render(Panel, props);
  nodes(tree, node => node.type === 'button' && textContent(node) === 'Edit delivery details')[0].props.onClick();
  tree = client.render(Panel, props);
  nodes(tree, node => node.type === 'input' && node.props.id?.endsWith('-tracking'))[0].props.onChange({ target: { value: 'TRACK-RECOVER' } });
  tree = client.render(Panel, props);
  await nodes(tree, node => node.type === 'form' && node.props.id?.endsWith('-delivery'))[0].props.action();
  tree = client.render(Panel, props);
  assert.equal(nodes(tree, node => node.type === 'input' && node.props.id?.endsWith('-tracking'))[0].props.value, 'TRACK-RECOVER');
  assert.match(textContent(tree), /couldn’t confirm this update/); assert.doesNotMatch(textContent(tree), /PRIVATE NETWORK/);
  assert.equal(saved[0][0], 'hh-order-edits-owner-portion'); assert.equal(saved[0][1].tracking_number[0], 'TRACK-RECOVER');
});

test('export failures stay in the order UI with recovery rather than exposing response JSON', async () => {
  for (const outcome of ['server', 'network', 'login']) {
    const client = clientHooks();
    const Tools = load('components/order-export-tools.tsx', { react: client.hooks }, { fetch: async () => {
      if (outcome === 'network') throw new Error('PRIVATE TRANSPORT');
      return { ok: false, status: 500, redirected: outcome === 'login', headers: { get: () => 'application/json' }, json: () => ({ error: 'PRIVATE DATABASE DETAILS' }) };
    } }).OrderExportTools;
    let tree = client.render(Tools, {});
    let prevented = false;
    nodes(tree, node => node.type === 'a' && node.props.href?.includes('scope=unfulfilled'))[0].props.onClick({ preventDefault() { prevented = true; }, currentTarget: { href: '/lister/orders/export?scope=unfulfilled' } });
    await new Promise(resolve => setTimeout(resolve, 0));
    tree = client.render(Tools, {});
    assert.equal(prevented, true);
    assert.match(textContent(tree), outcome === 'login' ? /log in again/ : /couldn’t (export|download)/);
    assert.doesNotMatch(textContent(tree), /PRIVATE/);
  }
});

test('storefront zero-row saves return an error without success navigation or logo cleanup', async () => {
  const client = { from: () => { let saving = false; return { select() { return this; }, eq() { return this; }, update() { saving = true; return this; }, maybeSingle: async () => saving ? { data: null, error: null } : { data: { user_id: 'owner', logo_url: null }, error: null } }; } };
  const action = load('app/lister/actions.ts', { 'next/navigation': { redirect }, 'next/cache': { revalidatePath() {} }, '@/lib/auth/require-user': { requireRole: async () => ({ user: { id: 'owner' }, supabase: client }) } }).saveStorefront;
  const data = new FormData(); for (const [key, value] of Object.entries({ business_name: 'Fixture shop', description: 'Handmade products', category_type: 'Books', delivery_charge: '0' })) data.set(key, value);
  const result = await action({ error: '' }, data);
  assert.match(result.error, /couldn't confirm your shop was saved/);
});

test('profile zero-row updates never claim the profile was updated', async () => {
  const action = load('app/account/actions.ts', { 'next/navigation': { redirect }, 'next/cache': { revalidatePath() {} }, '@/lib/auth/require-user': { requireUser: async () => ({ user: { id: 'owner' }, supabase: { from: () => ({ ...query({ data: null, error: null }), update() { return this; } }) } }) } }).updateProfile;
  const data = new FormData(); data.set('full_name', 'Fixture name');
  await assert.rejects(action(data), error => /couldn.*confirm/.test(decodeURIComponent(error.message)) && !/Profile%20updated/.test(error.message));
});
