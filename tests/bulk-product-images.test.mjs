import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypescript } from './helpers/load-typescript.mjs';

const { withProductCover, orderedProductImages, ownedProductImagePath } = loadTypescript('lib/product-images.ts');
const baseUrl = 'https://test.supabase.co';
class RemoteImageError extends Error {}
function fixture({ count = 1, failDownload = 0, failUpload = 0, failDb = false, loseResponse = false, uncertain = false, race = false, cleanupFailures = 0 } = {}) {
  const files = new Map([['someone-else/saved.png', 'saved'], ['lister-a/existing.png', 'saved']]);
  const products = new Map(); const uploads = []; const removed = []; let downloads = 0; let calls = 0; let removeCalls = 0;
  const row = { row: 2, product: { name: 'Book', description: 'Description', category_type: 'Books', sku: 'BOOK-1', price: 5, stock_quantity: 2, sizes: [], stockQuantities: [] }, errors: [], warnings: [], imageUrls: Array.from({ length: count }, (_, i) => `https://images.example.com/${i}.png`) };
  const storage = {
    getPublicUrl: path => ({ data: { publicUrl: `${baseUrl}/storage/v1/object/public/product-images/${path}` } }),
    async upload(path, bytes, options) {
      uploads.push(path); assert.equal(options.upsert, false); assert.equal(options.contentType, 'image/png');
      if (uploads.length === failUpload) return { error: { message: 'raw private Supabase details' } };
      files.set(path, bytes); return { error: null };
    },
    async remove(paths) {
      removeCalls++;
      if (removeCalls <= cleanupFailures) return { error: { message: 'temporary storage failure' } };
      for (const path of paths) { assert.ok(uploads.includes(path)); assert.ok(path.startsWith('lister-a/')); removed.push(path); files.delete(path); }
      return { error: null };
    },
  };
  const supabase = {
    storage: { from: bucket => { assert.equal(bucket, 'product-images'); return storage; } },
    from(table) {
      assert.equal(table, 'products'); const q = { select() { return q; }, eq() { return q; }, async maybeSingle() { return { data: products.get('stable-id') ?? null, error: null }; } }; return q;
    },
    async rpc(name, args) {
      calls++; assert.equal(name, 'import_product_csv_row'); assert.equal(args.p_id, 'stable-id');
      if (uncertain) throw new Error('connection lost');
      if (failDb) return { error: { code: '23514', message: 'raw database details' }, data: null };
      if (race) return { error: null, data: 'already imported' };
      if (products.has(args.p_id)) return { error: null, data: 'already imported' };
      products.set(args.p_id, { image_url: args.p_images[0] ?? null, is_published: false, review_status: 'draft', product_images: args.p_images.map((image_url, sort_order) => ({ image_url, sort_order })) });
      if (loseResponse) throw new Error('connection lost after commit');
      return { error: null, data: 'imported' };
    },
  };
  const { importBulkProductRow } = loadTypescript('lib/bulk-product-images.ts', {
    './remote-product-image': { RemoteImageError, async downloadProductImage(url) {
      downloads++;
      if (downloads === failDownload) throw new RemoteImageError('could not be downloaded.');
      return { bytes: Buffer.from(url), extension: 'png', contentType: 'image/png' };
    } },
    './product-images': { ownedProductImagePath: (url, userId) => ownedProductImagePath(url, userId, baseUrl) },
  });
  return { run: () => importBulkProductRow(supabase, 'lister-a', 'stable-id', row), files, products, uploads, removed, metrics: () => ({ downloads, calls, removeCalls }) };
}
for (const count of [1, 5]) test(`imports ${count} owned images ordered with first as cover, remains Draft and uses normal gallery helpers`, async () => {
  const f = fixture({ count }); const result = await f.run(); assert.equal(result.status, 'imported');
  const product = f.products.get('stable-id'); assert.equal(product.is_published, false); assert.equal(product.review_status, 'draft');
  assert.equal(product.product_images.length, count); assert.equal(withProductCover(product).image_url, product.product_images[0].image_url);
  assert.deepEqual([...orderedProductImages(product.product_images, product.image_url)], f.uploads.map(path => `https://test.supabase.co/storage/v1/object/public/product-images/${path}`));
  f.uploads.forEach((path, i) => assert.equal(f.files.get(path).toString(), `https://images.example.com/${i}.png`));
});
test('exact retry avoids duplicate products, gallery rows, downloads and storage uploads', async () => {
  const f = fixture({ count: 5 }); await f.run(); const before = f.metrics(); const result = await f.run();
  assert.equal(result.status, 'already imported'); assert.equal(f.products.size, 1); assert.equal(f.uploads.length, 5); assert.deepEqual(f.metrics(), before);
});
test('completed retry preserves later manual gallery edits', async () => {
  const f = fixture(); await f.run(); const product = f.products.get('stable-id');
  product.product_images = [{ image_url: 'manual-edit', sort_order: 0 }]; product.image_url = 'manual-edit';
  assert.equal((await f.run()).status, 'already imported'); assert.equal(product.product_images[0].image_url, 'manual-edit'); assert.equal(f.removed.length, 0);
});
test('confirmed database failure removes only this attempt uploads and leaves no product', async () => {
  const f = fixture({ count: 5, failDb: true, cleanupFailures: 1 }); const result = await f.run();
  assert.equal(result.status, 'failed'); assert.ok(!/raw|database details/.test(result.message)); assert.equal(f.products.size, 0); assert.equal(f.files.size, 2); assert.equal(f.removed.length, 5); assert.equal(f.metrics().removeCalls, 2);
});
test('later image download or upload failure cleans earlier uploads and never calls database', async () => {
  for (const options of [{ failDownload: 2 }, { failUpload: 2 }]) {
    const f = fixture({ count: 5, ...options }); const result = await f.run();
    assert.equal(result.status, 'failed'); assert.match(result.message, /Image 2/); assert.ok(!result.message.includes('raw')); assert.equal(f.files.size, 2); assert.equal(f.metrics().calls, 0);
  }
});
test('concurrent winner returns already imported and cleans only losing attempt files', async () => {
  const f = fixture({ race: true }); assert.equal((await f.run()).status, 'already imported'); assert.equal(f.removed.length, 1); assert.equal(f.files.size, 2);
});
test('lost commit response is resolved through exact RPC retry without deleting saved images', async () => {
  const f = fixture({ loseResponse: true }); assert.equal((await f.run()).status, 'already imported');
  assert.equal(f.metrics().calls, 2); assert.equal(f.uploads.length, 1); assert.equal(f.removed.length, 0); assert.equal(f.products.size, 1);
  const before = f.metrics(); await f.run(); assert.deepEqual(f.metrics(), before);
});
test('unknown database outcome retains potentially committed files and offers safe retry', async () => {
  const f = fixture({ uncertain: true }); const result = await f.run(); assert.equal(result.status, 'failed'); assert.match(result.message, /could not be confirmed/); assert.equal(f.removed.length, 0);
});
