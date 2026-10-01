import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { createHash } from 'node:crypto';

function load(file, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    if (name in dependencies) return dependencies[name];
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts`), dependencies);
    throw new Error(`Unexpected dependency ${name}`);
  }, TextEncoder, URL, console });
  return exports;
}
const { CSV_COLUMNS, parseCsv, validateProductCsv } = load('lib/product-csv.ts');
const { buildCsv } = load('lib/fulfilment.ts');
function row(values = {}) {
  const product = { 'Product name': 'Book', Description: 'A lovely book', Price: '12.50', 'Stock quantity': '5', SKU: 'BOOK-1', Category: 'Books', 'Image URL': '', ...values };
  return CSV_COLUMNS.map(column => product[column] ?? '');
}
const csv = rows => buildCsv(CSV_COLUMNS, rows);
function fixture({ existing = [], failAt = -1, loseResponseAt = -1 } = {}) {
  const products = new Map(existing.map(product => [product.id, product]));
  const calls = []; let failures = 0; let lostResponses = 0;
  const supabase = { from(table) {
    let owner; let begin = 0; let end = 999;
    const query = {
      select() { return query; }, eq(key, value) { assert.equal(key, table === 'products' ? 'lister_user_id' : 'user_id'); owner = value; return query; },
      not() { return query; }, order() { return query; }, range(a, b) { begin = a; end = b; return query; },
      maybeSingle: async () => ({ data: owner === 'lister-a' ? { user_id: owner } : null, error: null }),
      then(resolve, reject) { assert.equal(owner, 'lister-a'); return Promise.resolve({ data: [...products.values()].filter(product => product.lister_user_id === owner && product.sku).slice(begin, end + 1), error: null }).then(resolve, reject); },
    }; return query;
  }, async rpc(name, args) {
    assert.equal(name, 'import_product_csv_row'); calls.push(args);
    assert.ok(!('lister_user_id' in args.p_product));
    assert.ok(!('is_published' in args.p_product));
    if (products.has(args.p_id)) return { data: 'already imported', error: null };
    if (calls.length - 1 === failAt && failures++ === 0) return { data: null, error: { code: 'unexpected' } };
    products.set(args.p_id, { id: args.p_id, sku: args.p_product.sku, lister_user_id: 'lister-a' });
    if (calls.length - 1 === loseResponseAt && lostResponses++ === 0) throw new Error('Response lost');
    return { data: 'imported', error: null };
  } };
  const action = load('app/lister/products/bulk/actions.ts', {
    'node:crypto': { createHash }, 'next/cache': { revalidatePath() {} },
    '@/lib/auth/require-user': { requireRole: async role => { assert.equal(role, 'lister'); return { supabase, user: { id: 'lister-a' } }; } },
    '@/lib/product-csv': { validateProductCsv },
  }).processProductCsv;
  async function run(text, confirm = false, extras = {}) {
    const data = new FormData(); data.set('csv', text); if (confirm) data.set('confirm', 'yes');
    for (const [key, value] of Object.entries(extras)) data.set(key, value);
    return action({}, data);
  }
  return { run, calls, products };
}
test('five valid rows preview without writes and import only after confirmation', async () => {
  const f = fixture(); const text = csv(Array.from({ length: 5 }, (_, i) => row({ SKU: `BOOK-${i}` })));
  const preview = await f.run(text);
  assert.equal(preview.rows.filter(row => row.product).length, 5); assert.equal(f.calls.length, 0);
  const result = await f.run(text, true);
  assert.equal(result.results.filter(row => row.status === 'imported').length, 5); assert.equal(f.products.size, 5);
});
test('invalid category does not block valid rows', async () => {
  const f = fixture(); const result = await f.run(csv([row(), row({ Category: 'Clothes', SKU: 'BAD' })]), true);
  assert.equal(result.results[0].status, 'imported'); assert.equal(result.results[1].status, 'failed');
  assert.match(result.results[1].message, /Invalid category "Clothes"/);
});
test('malformed price and negative, decimal, exponent or oversized stock are rejected', () => {
  for (const Price of ['£12.50', '1.234', 'NaN', '1e2', '-2', '']) assert.ok(validateProductCsv(csv([row({ Price })]))[0].errors.some(error => error.includes('Price')));
  for (const stock of ['-1', '1.5', '1e2', 'Infinity', '2147483648', '']) assert.ok(validateProductCsv(csv([row({ 'Stock quantity': stock })]))[0].errors.some(error => error.includes('Stock quantity')));
});
test('duplicate SKUs in a file are flagged case-insensitively on every matching row', () => {
  const rows = validateProductCsv(csv([row({ SKU: ' Abc ' }), row({ SKU: 'abc' })]));
  assert.ok(rows.every(row => row.errors.includes('Duplicate SKU in this CSV.')));
});
test('existing SKU blocks same lister but another lister can use the same SKU', async () => {
  const f = fixture({ existing: [{ id: 'existing', lister_user_id: 'lister-a', sku: 'book-1' }, { id: 'foreign', lister_user_id: 'lister-b', sku: 'SHARED' }] });
  const state = await f.run(csv([row(), row({ SKU: 'shared' })]));
  assert.ok(state.rows[0].errors.some(error => error.includes('existing products'))); assert.ok(state.rows[1].product);
});
test('Apparel uses all six existing relational sizes and non-Apparel uses product stock', async () => {
  const f = fixture();
  await f.run(csv([row({ Category: 'Apparel', SKU: 'SHIRT', 'Stock quantity': '', 'XS Stock': '0', 'S Stock': '1', 'M Stock': '2', 'L Stock': '3', 'XL Stock': '0', 'XXL Stock': '0' }), row()]), true);
  assert.deepEqual([...f.calls[0].p_sizes], ['XS', 'S', 'M', 'L', 'XL', 'XXL']);
  assert.deepEqual([...f.calls[0].p_stock_quantities], [0, 1, 2, 3, 0, 0]);
  assert.equal(f.calls[1].p_product.stock_quantity, 5); assert.equal(f.calls[1].p_sizes.length, 0);
  assert.ok(validateProductCsv(csv([row({ Category: 'Apparel' })]))[0].errors.some(error => error.includes('Apparel')));
  assert.ok(validateProductCsv(csv([row({ 'M Stock': '2' })]))[0].errors.some(error => error.includes('only available')));
});
test('remote URLs are validated but never sent to the import RPC', async () => {
  const f = fixture(); const result = await f.run(csv([row({ 'Image URL': 'https://example.com/photo.jpg' })]), true);
  assert.ok(result.rows[0].warnings[0].includes('not be saved')); assert.ok(!('image_url' in f.calls[0].p_product));
  for (const image of ['javascript:alert(1)', 'file:///tmp/photo', 'not-a-url']) assert.ok(validateProductCsv(csv([row({ 'Image URL': image })]))[0].errors.some(error => error.includes('Image URL')));
});
test('partial failure and lost response retry without duplicating completed rows', async () => {
  for (const config of [{ failAt: 1 }, { loseResponseAt: 1 }]) {
    const f = fixture(config); const text = csv([row(), row({ SKU: 'BOOK-2' }), row({ SKU: 'BOOK-3' })]);
    const first = await f.run(text, true); assert.equal(first.results.filter(row => row.status === 'failed').length, 1);
    const retried = await f.run(text, true); assert.ok(retried.results.every(row => row.status !== 'failed')); assert.equal(f.products.size, 3);
  }
});
test('ownership fields are ignored and database function forces private drafts under existing RLS', async () => {
  const f = fixture(); await f.run(csv([row()]), true, { lister_user_id: 'lister-b', is_published: 'true', review_status: 'approved', product_id: 'foreign' });
  assert.ok([...f.products.values()].every(product => product.lister_user_id === 'lister-a'));
  const sql = fs.readFileSync('supabase/migrations/020_bulk_product_csv.sql', 'utf8');
  assert.match(sql, /security invoker/); assert.match(sql, /p_id, auth.uid\(\)/); assert.match(sql, /null, false/); assert.match(sql, /perform public.save_product_variants/); assert.match(sql, /from public, anon/);
  const policies = fs.readFileSync('supabase/migrations/008_product_review_workflow.sql', 'utf8');
  assert.ok(policies.includes("review_status = 'approved'"));
});
test('CSV handles quoted commas, newlines, escaped quotes and BOM; refuses ambiguous files and limits', () => {
  const text = '\uFEFF' + csv([row({ 'Product name': 'Book, blue', Description: 'Line one\nLine "two"' })]);
  const parsed = validateProductCsv(text); assert.equal(parsed[0].product.name, 'Book, blue'); assert.equal(parsed[0].product.description, 'Line one\nLine "two"');
  assert.throws(() => parseCsv('"unclosed'), /unclosed/);
  assert.throws(() => validateProductCsv('Wrong headings\nrow'), /template/);
  assert.throws(() => validateProductCsv(csv(Array.from({ length: 101 }, () => row()))), /100/);
  assert.throws(() => validateProductCsv('x'.repeat(256 * 1024 + 1)), /256 KB/);
});
