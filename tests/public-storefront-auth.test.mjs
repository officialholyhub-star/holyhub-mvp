import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(fs.readFileSync('lib/supabase/proxy.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
async function visit(path, signedIn = false) {
  const exports = {};
  vm.runInNewContext(code, { exports, process: { env: {} }, require: name => {
    if (name === '@supabase/ssr') return { createServerClient: () => ({ auth: { getClaims: async () => ({ data: { claims: signedIn ? { sub: 'user' } : {} } }) } }) };
    if (name === 'next/server') return { NextResponse: { next: () => ({ status: 200 }), redirect: url => ({ status: 307, location: url.toString() }) } };
    throw new Error(`Unexpected import ${name}`);
  } });
  const url = new URL(path, 'https://example.com');
  url.clone = () => new URL(url);
  return exports.updateSession({ nextUrl: url, cookies: { getAll: () => [] } });
}
test('anonymous visitors can view the public storefront with or without a trailing slash', async () => {
  for (const path of ['/lister/storefront/seller-id', '/lister/storefront/seller-id/']) assert.equal((await visit(path)).status, 200);
});
test('storefront editing and all other lister/admin/customer account routes remain protected', async () => {
  for (const path of ['/lister', '/lister/storefront', '/lister/storefront/', '/lister/storefront/id/edit', '/lister/orders', '/lister/products/new', '/admin/products', '/account/orders']) {
    const result = await visit(path);
    assert.equal(result.status, 307, path);
    assert.equal(new URL(result.location).pathname, '/auth/login');
    assert.equal((await visit(path, true)).status, 200);
  }
});
