import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypescript } from './helpers/load-typescript.mjs';
import { page, query } from './helpers/render-progress.mjs';
const hash = 'a'.repeat(64);
async function accept({ version = 'v1', sha = hash, checked = true, error = null, returned = 'v1', authorized = true } = {}) {
  const calls = []; const revalidated = [];
  const { acceptListerTerms } = loadTypescript('app/lister/terms/actions.ts', {
    'next/navigation': { redirect: url => { throw new Error(decodeURIComponent(url)); } },
    'next/cache': { revalidatePath: path => revalidated.push(path) },
    '@/lib/auth/require-user': { requireRole: async role => { assert.equal(role, 'lister'); if (!authorized) throw new Error('unauthorized'); return { supabase: { rpc: async (name, args) => { calls.push({ name, args }); return { data: returned, error }; } } }; } },
  });
  const form = new FormData(); if (checked) form.set('accept_terms', 'on'); if (version !== null) form.set('terms_version', version); if (sha !== null) form.set('terms_sha256', sha);
  let message; try { await acceptListerTerms(form); } catch (e) { message = e.message; }
  return { calls, revalidated, message };
}
test('passes exact displayed version/hash with fixed source', async () => {
  const r = await accept(); assert.equal(r.calls.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(r.calls[0])), { name: 'accept_current_lister_terms', args: { p_source: 'lister_portal', p_version: 'v1', p_sha256: hash } });
  assert.match(r.message, /v1 accepted/); assert.equal(r.revalidated.length, 4);
});
for (const values of [{ version: null }, { version: '' }, { version: ' '.repeat(2) }, { version: 'v'.repeat(101) }, { sha: null }, { sha: 'bad' }, { checked: false }, { authorized: false }]) {
  test(`invalid/unauthorised submission never invokes RPC: ${JSON.stringify(values)}`, async () => assert.equal((await accept(values)).calls.length, 0));
}
test('stale version/hash or unavailable Terms require refresh without success', async () => {
  const r = await accept({ error: { code: 'P0002' }, returned: null }); assert.match(r.message, /refresh and read/); assert.equal(r.revalidated.length, 0);
});
test('RPC failure or unexpected returned version never reports acceptance', async () => {
  for (const values of [{ error: { code: '42501' } }, { returned: 'v2' }]) { const r = await accept(values); assert.match(r.message, /error=/); assert.equal(r.revalidated.length, 0); }
});
for (const state of ['current', 'none', 'error']) test(`Terms page ${state}: exact displayed binding or no form`, async () => {
  const html = await page('app/lister/terms/page.tsx', { rpc: async () => ({ data: state === 'none' ? [] : [{ version: 'v1', content_sha256: hash, published_path: '/lister-terms' }], error: state === 'error' ? {} : null }), from: () => query({ data: null, error: null }) }, {}, { '@/app/lister/terms/actions': { acceptListerTerms() {} } });
  if (state === 'current') { assert.match(html, /name="terms_version" value="v1"/); assert.match(html, new RegExp(`name="terms_sha256" value="${hash}"`)); assert.match(html, /Content SHA-256/); }
  else assert.doesNotMatch(html, /name="accept_terms"/);
});
