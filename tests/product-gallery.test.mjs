import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { setImmediate as flush } from 'node:timers/promises';
import ts from 'typescript';
import * as runtime from 'react/jsx-runtime';
import * as images from '../lib/product-images.ts';
import * as variants from '../lib/product-variants.ts';
import * as categories from '../lib/product-categories.ts';
import * as validation from '../lib/product-validation.ts';
import { hasMaterialProductChange } from '../lib/product-review.ts';

const origin = 'https://example.supabase.co';
const owner = '11111111-1111-4111-8111-111111111111';
const url = index => `${origin}/storage/v1/object/public/product-images/${owner}/image-${index}.jpg`;
function load(file, dependencies) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(source, { exports, crypto: webcrypto, URL, console, process: { env: { NEXT_PUBLIC_SUPABASE_URL: origin } }, require: name => {
    if (name in dependencies) return dependencies[name];
    if (name.endsWith('.module.css')) return { default: {} };
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return exports;
}
function walk(tree, predicate) {
  const result = [];
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) result.push(node);
    if (node.props) visit(node.props.children);
  }
  visit(tree); return result;
}
function component(file, name, props, dependencies = {}) {
  const slots = []; let cursor = 0;
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
  };
  const C = load(file, { react: hooks, 'react/jsx-runtime': runtime, 'next/image': { default: 'img' }, '@/lib/product-images': { ...images, ownedProductImagePath: (value, id) => images.ownedProductImagePath(value, id, origin) }, ...dependencies })[name];
  return () => { cursor = 0; return C(props); };
}
const button = (tree, label) => walk(tree, node => node.type === 'button' && node.props['aria-label'] === label)[0];

test('ordered gallery wins over legacy cover; legacy and empty products remain compatible', () => {
  const rows = [{ image_url: url(2), sort_order: 1 }, { image_url: url(1), sort_order: 0 }];
  assert.deepEqual(images.orderedProductImages(rows, 'legacy'), [url(1), url(2)]);
  assert.equal(images.withProductCover({ image_url: 'legacy', product_images: rows }).image_url, url(1));
  assert.deepEqual(images.orderedProductImages([], 'legacy'), ['legacy']);
  assert.deepEqual(images.orderedProductImages(null, null), []);
  assert.equal(rows[0].sort_order, 1);
});
test('reordering changes only positions and makes the first image the cover', () => {
  assert.deepEqual(images.moveProductImage([url(1), url(2), url(3)], 2, 0), [url(3), url(1), url(2)]);
  assert.equal(images.withProductCover({ image_url: 'old', product_images: images.moveProductImage([url(1), url(2)], 1, 0).map((image_url, sort_order) => ({ image_url, sort_order })) }).image_url, url(2));
});
test('gallery validation rejects foreign-owned URLs, duplicates and six images; permits compatible legacy images', () => {
  assert.ok(images.validProductImages([], owner));
  const saved = process.env.NEXT_PUBLIC_SUPABASE_URL; process.env.NEXT_PUBLIC_SUPABASE_URL = origin;
  try {
    assert.ok(images.validProductImages(Array.from({ length: 5 }, (_, i) => url(i)), owner));
    assert.ok(!images.validProductImages(Array.from({ length: 6 }, (_, i) => url(i)), owner));
    assert.ok(!images.validProductImages([url(1), url(1)], owner));
    assert.ok(!images.validProductImages([url(1).replace(owner, 'foreign-owner')], owner));
    assert.ok(images.validProductImages(['https://legacy.example/image.jpg'], owner, ['https://legacy.example/image.jpg']));
    assert.equal(images.ownedProductImagePath(`${origin}/storage/v1/object/public/product-images/${owner}/a%2Fb.jpg`, owner, origin), null);
  } finally { if (saved === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = saved; }
});
test('one-image gallery omits navigation and zoom supports Close and Escape', () => {
  const render = component('components/product-gallery.tsx', 'ProductGallery', { images: [url(1)], name: 'Shirt' });
  const tree = render(); assert.equal(button(tree, 'Next product image'), undefined);
  let opened = 0; let closed = 0;
  const dialog = walk(tree, node => node.type === 'dialog')[0]; dialog.props.ref.current = { showModal() { opened++; }, close() { closed++; } };
  button(tree, 'Enlarge Shirt image 1').props.onClick(); assert.equal(opened, 1);
  walk(tree, node => node.type === 'button' && node.props.children === 'Close')[0].props.onClick();
  dialog.props.onCancel({ preventDefault() {} }); assert.equal(closed, 2);
  assert.ok(dialog.props['aria-label']);
});
test('five-image gallery supports thumbnail selection, previous/next, keyboard and mobile swipe', () => {
  const render = component('components/product-gallery.tsx', 'ProductGallery', { images: Array.from({ length: 5 }, (_, i) => url(i)), name: 'Shirt' });
  let tree = render(); button(tree, 'Show product image 3').props.onClick(); tree = render();
  assert.ok(button(tree, 'Enlarge Shirt image 3'));
  button(tree, 'Next product image').props.onClick(); tree = render(); assert.ok(button(tree, 'Enlarge Shirt image 4'));
  button(tree, 'Previous product image').props.onClick(); tree = render();
  button(tree, 'Enlarge Shirt image 3').props.onKeyDown({ key: 'ArrowLeft', preventDefault() {} }); tree = render();
  const main = button(tree, 'Enlarge Shirt image 2');
  main.props.onTouchStart({ touches: [{ clientX: 200 }] }); main.props.onTouchEnd({ changedTouches: [{ clientX: 100 }] }); tree = render();
  assert.ok(button(tree, 'Enlarge Shirt image 3'));
  assert.equal(walk(tree, node => node.props?.['aria-pressed'] !== undefined).length, 5);
});
test('uploader accepts five images, rejects a sixth, reorders, replaces safely and removes only temporary owned files', async () => {
  const uploaded = []; const removed = [];
  const storage = { async upload(path, file) { uploaded.push({ path, file }); return { error: null }; }, getPublicUrl(path) { return { data: { publicUrl: `${origin}/storage/v1/object/public/product-images/${path}` } }; }, async remove(paths) { removed.push(...paths); return { error: null }; } };
  const render = component('components/product-image-uploader.tsx', 'ProductImageUploader', { userId: owner, initialImageUrl: null, onUploadingChange() {} }, { '@/lib/supabase/client': { createClient: () => ({ storage: { from: () => storage } }) } });
  const input = tree => walk(tree, node => node.type === 'input' && node.props.type === 'file')[0];
  let tree = render(); input(tree).props.onChange({ currentTarget: { files: Array.from({ length: 5 }, (_, i) => new File(['data'], `${i}.jpg`, { type: 'image/jpeg' })), value: 'file' } }); await flush(); tree = render();
  assert.equal(uploaded.length, 5); assert.equal(walk(tree, node => node.type === 'input' && node.props.name === 'image_urls').length, 5);
  const before = walk(tree, node => node.type === 'input' && node.props.name === 'image_urls').map(node => node.props.value);
  button(tree, 'Move image 2 earlier').props.onClick(); tree = render();
  assert.equal(walk(tree, node => node.type === 'input' && node.props.name === 'image_url')[0].props.value, before[1]);
  input(tree).props.onChange({ currentTarget: { files: [new File(['data'], 'six.jpg', { type: 'image/jpeg' })], value: 'file' } }); await flush(); assert.equal(uploaded.length, 5);
  tree = render(); await walk(tree, node => node.type === 'button' && node.props.children === 'Remove')[0].props.onClick(); await flush(); tree = render();
  assert.equal(removed.length, 1); assert.ok(removed[0].startsWith(`${owner}/`));
  assert.equal(walk(tree, node => node.type === 'input' && node.props.name === 'image_urls').length, 4);
  // Replacing a persisted legacy image must not delete it before or after upload.
  const legacy = component('components/product-image-uploader.tsx', 'ProductImageUploader', { userId: owner, initialImageUrl: url(99), onUploadingChange() {} }, { '@/lib/supabase/client': { createClient: () => ({ storage: { from: () => storage } }) } });
  tree = legacy(); input(tree).props.ref.current = { click() {} };
  walk(tree, node => node.type === 'button' && node.props.children === 'Replace')[0].props.onClick();
  input(tree).props.onChange({ currentTarget: { files: [new File(['data'], 'new.avif', { type: 'image/avif' })], value: 'file' } }); await flush();
  assert.equal(uploaded.at(-1).file.type, 'image/avif'); assert.equal(removed.length, 1);
});
function productActions() {
  const calls = [];
  const supabase = { from() { const query = { select() { return query; }, eq() { return query; }, maybeSingle: async () => ({ data: { image_url: url(1), product_images: [] }, error: null }) }; return query; }, rpc: async (name, args) => { calls.push({ name, args }); return { error: null }; } };
  const actions = load('app/lister/actions.ts', { 'next/cache': { revalidatePath() {} }, 'next/navigation': { redirect: value => { throw new Error(`REDIRECT:${value}`); } }, '@/lib/auth/require-user': { requireRole: async () => ({ supabase, user: { id: owner } }) }, '@/lib/product-images': { ...images, validProductImages: (urls, user, existing) => urls.length <= 5 && new Set(urls).size === urls.length && urls.every(value => existing?.includes(value) || images.ownedProductImagePath(value, user, origin)), ownedProductImagePath: (value, user) => images.ownedProductImagePath(value, user, origin) }, '@/lib/product-categories': categories, '@/lib/product-variants': variants, '@/lib/product-validation': validation });
  return { calls, ...actions };
}
function form(publish = false, urls = []) {
  const data = new FormData(); for (const [key, value] of Object.entries({ name: 'Book', description: 'Lovely book', category_type: 'Books', price: '12.50', stock_quantity: '5', gallery_present: '1' })) data.set(key, value);
  if (publish) data.set('is_published', 'on'); urls.forEach(value => data.append('image_urls', value)); return data;
}
test('real create action permits image-free drafts, blocks image-free submission, and saves galleries atomically', async () => {
  const actions = productActions(); await assert.rejects(actions.createProduct(form()), /Product%20created/);
  assert.equal(actions.calls[0].args.p_images.length, 0); assert.equal(actions.calls[0].args.p_values.is_published, false);
  await assert.rejects(actions.createProduct(form(true)), /Add%20at%20least%20one/); assert.equal(actions.calls.length, 1);
  await assert.rejects(actions.createProduct(form(true, [url(1), url(2)])), /Product%20created/);
  assert.equal(actions.calls[1].name, 'save_product_with_images'); assert.equal(actions.calls[1].args.p_values.image_url, url(1));
  await assert.rejects(actions.createProduct(form(true, [url(1).replace(owner, 'foreign')])), /valid%20values/); assert.equal(actions.calls.length, 2);
});
test('gallery-only changes are material and migration preserves ordered snapshots without allowing direct API mutations', () => {
  const product = { name: 'Book', description: 'Book', category_type: 'Books', image_url: url(1), size_guide_url: null, gallery_images: [url(1), url(2)] };
  assert.equal(hasMaterialProductChange(product, { ...product, gallery_images: [url(1), url(3)] }), true);
  assert.equal(hasMaterialProductChange(product, { ...product, gallery_images: [url(2), url(1)] }), true);
  const sql = fs.readFileSync('supabase/migrations/021_product_gallery.sql', 'utf8');
  assert.ok(sql.includes('new.gallery_revision is distinct from old.gallery_revision'));
  assert.ok(sql.includes('previous_gallery_images'));
  assert.ok(sql.indexOf('update public.products set image_url') < sql.indexOf('delete from public.product_images'));
  assert.ok(sql.includes('and lister_user_id = auth.uid() for update'));
  assert.ok(sql.includes('security invoker'));
  assert.ok(!/grant (insert|update|delete).*public.product_images.*authenticated/i.test(sql));
});
test('all cover contexts use galleries, product buying page has internal brand links, storefront external links follow products safely', () => {
  for (const file of ['app/marketplace/page.tsx', 'app/page.tsx', 'app/account/favourites/page.tsx', 'app/lister/storefront/[id]/page.tsx', 'components/basket-view.tsx']) {
    const text = fs.readFileSync(file, 'utf8'); assert.ok(text.includes('product_images(image_url, sort_order)'), file); assert.ok(text.includes('withProductCover'), file);
  }
  const detail = fs.readFileSync('app/products/[id]/page.tsx', 'utf8');
  assert.ok(!detail.includes('website_url')); assert.ok(!detail.includes('instagram_url')); assert.ok(detail.includes('href={`/lister/storefront/'));
  const storefront = fs.readFileSync('app/lister/storefront/[id]/page.tsx', 'utf8');
  assert.ok(storefront.indexOf('storefront-products-title') < storefront.indexOf('Instagram or social ↗'));
  assert.ok(storefront.indexOf('Instagram or social ↗') < storefront.indexOf('Visit brand website ↗'));
  assert.ok(storefront.includes('target="_blank" rel="noopener noreferrer"'));
});
