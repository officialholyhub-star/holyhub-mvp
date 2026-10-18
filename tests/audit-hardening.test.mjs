import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20261018010000_audit_readiness_hardening.sql', 'utf8');
const demoProducts = fs.readFileSync('lib/demo-products.ts', 'utf8');
const home = fs.readFileSync('app/page.tsx', 'utf8');
const marketplace = fs.readFileSync('app/marketplace/page.tsx', 'utf8');

test('public seller identity uses the complete customer-readiness gate', () => {
  assert.match(migration, /seller_dispatch_is_ready\(s\.user_id\)/);
  assert.match(migration, /seller_terms_are_current\(s\.user_id\)/);
  assert.match(migration, /verification_status = 'verified'/);
});

test('Lister Terms acceptance is single-current-version and does not rewrite acceptance evidence', () => {
  assert.match(migration, /lister_terms_one_active_idx/);
  assert.match(migration, /on conflict \(user_id, terms_version\) do nothing/);
  assert.doesNotMatch(migration, /set terms_sha256 = excluded\.terms_sha256/);
  assert.match(migration, /with current_terms as/);
});

test('demo catalogue fixtures are development-only and not rendered by public catalogue pages', () => {
  assert.match(demoProducts, /process\.env\.NODE_ENV === "development"/);
  assert.doesNotMatch(home, /demoProducts|demo-products/);
  assert.doesNotMatch(marketplace, /demoProducts|demo-products/);
});
