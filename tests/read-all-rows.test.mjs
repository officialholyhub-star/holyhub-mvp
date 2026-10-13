import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypescript } from './helpers/load-typescript.mjs';
const { readAllRows } = loadTypescript('lib/read-all-rows.ts');
test('admin lists include records beyond the PostgREST response cap', async () => {
  const rows = Array.from({ length: 1001 }, (_, id) => ({ id }));
  const offsets = [];
  const result = await readAllRows(async offset => { offsets.push(offset); return { data: rows.slice(offset, offset + 1000), error: null }; });
  assert.equal(result.data.length, 1001);
  assert.equal(result.data.at(-1).id, 1000);
  assert.deepEqual(offsets, [0, 1000]);
});
test('a later failed page is reported instead of presenting an incomplete catalogue', async () => {
  const result = await readAllRows(async offset => offset ? { data: null, error: 'Unavailable' } : { data: Array(1000).fill({}), error: null });
  assert.equal(result.data, null);
  assert.equal(result.error, 'Unavailable');
});
test('a null successful response remains unavailable instead of an empty list', async () => {
  const result = await readAllRows(async () => ({ data: null, error: null }));
  assert.equal(result.data, null);
  assert.ok(result.error);
});
