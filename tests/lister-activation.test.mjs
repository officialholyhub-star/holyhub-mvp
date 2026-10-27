import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { loadTypescript } from './helpers/load-typescript.mjs';
import { page, query, load, render } from './helpers/render-progress.mjs';
const { listerActivationStatus, loadListerActivation } = loadTypescript('lib/lister-activation.ts');
const current = { version: 'reviewed-test-version', content_sha256: 'a'.repeat(64) };
const ready = () => ({ identity: { verification_status: 'verified' }, storefront: { dispatch_window: 'working-days', dispatch_custom_timeframe: '4' }, currentTerms: current, acceptedCurrent: true });

test('identity distinguishes missing, pending, verified, rejected and load failure', () => {
  assert.equal(listerActivationStatus({}).identity.reason, 'missing');
  assert.equal(listerActivationStatus({ identity: { verification_status: 'pending' } }).identity.state, 'pending_review');
  assert.equal(listerActivationStatus(ready()).identity.state, 'complete');
  const rejected = listerActivationStatus({ identity: { verification_status: 'rejected', verification_note: 'Check details' } });
  assert.equal(rejected.identity.reason, 'rejected'); assert.equal(rejected.identity.detail, 'Check details');
  assert.equal(listerActivationStatus({ ...ready(), errors: { identity: true } }).identity.state, 'error');
});
test('dispatch validates and formats exact working days; missing/invalid never becomes ready', () => {
  const status = listerActivationStatus(ready()); assert.equal(status.dispatch.detail, 'Dispatch within 4 working days'); assert.equal(status.ready, true);
  for (const value of ['', '0', '31', '1.5', 'four']) {
    const invalid = listerActivationStatus({ ...ready(), storefront: { dispatch_window: 'working-days', dispatch_custom_timeframe: value } });
    assert.equal(invalid.dispatch.state, 'action_required'); assert.equal(invalid.ready, false);
  }
  assert.equal(listerActivationStatus({ ...ready(), storefront: null }).dispatch.reason, 'missing');
  assert.equal(listerActivationStatus({ ...ready(), storefront: { dispatch_window: 'made-to-order', dispatch_custom_timeframe: '10 working days' } }).dispatch.state, 'complete');
});
test('Terms distinguishes HolyHub hold, actionable acceptance, accepted and load failure', () => {
  assert.equal(listerActivationStatus({ ...ready(), currentTerms: null }).terms.state, 'waiting');
  assert.equal(listerActivationStatus({ ...ready(), acceptedCurrent: false }).terms.state, 'action_required');
  assert.equal(listerActivationStatus(ready()).terms.state, 'complete');
  assert.equal(listerActivationStatus({ ...ready(), errors: { terms: true } }).terms.state, 'error');
  assert.equal(listerActivationStatus({ ...ready(), acceptedCurrent: null }).ready, false);
});
function fixture({ identity = { verification_status: 'verified' }, storefront = ready().storefront, terms = [current], accepted = true, fail = '', products = [{ id: 'p', name: 'Prepared product', lister_user_id: 'owner', review_status: 'approved', is_published: true }] } = {}) {
  return {
    from(table) {
      const data = table === 'seller_legal_profiles' ? identity : table === 'lister_storefronts' ? { business_name: 'Fixture shop', ...storefront } : table === 'products' ? products : [];
      return query(table === fail ? { data: null, error: {} } : { data: table === 'lister_storefronts' && storefront === null ? null : data, count: 0, error: null });
    },
    rpc: async name => name === fail ? { data: null, error: {} } : { data: name === 'get_current_lister_terms' ? terms : accepted, error: null },
  };
}
const deps = {
  '@/lib/fulfilment-summary': { getSellerFulfilmentSummary: async () => null },
  '@/components/storefront-form': { StorefrontForm: () => null },
  '@/components/draft-form': { ClearDraft: () => null },
  './actions': { advanceOnboarding() {} },
};
test('loader treats RPC failure as unknown, not missing Terms or accepted', async () => {
  const s = await loadListerActivation(fixture({ fail: 'get_current_lister_terms' }), 'owner');
  assert.equal(s.terms.state, 'error'); assert.equal(s.ready, false);
});
test('existing products/stale cookies never hide wizard requirements', async () => {
  for (const cookie of [undefined, '1:later', '2:later', '4:later', '5:later']) {
    const html = await page('app/lister/onboarding/page.tsx', fixture({ identity: null, terms: [], accepted: false }), {}, { ...deps, 'next/headers': { cookies: async () => ({ get: () => cookie ? { value: cookie } : undefined }) } });
    assert.match(html, /Seller details needed/); assert.match(html, /Waiting for HolyHub/);
    assert.match(html, /legal-details\?onboarding=1/); assert.match(html, /Setup progress is separate from activation/);
  }
});
test('dashboard never labels products live when identity, dispatch or Terms block activation', async () => {
  for (const input of [{ identity: null }, { identity: { verification_status: 'pending' } }, { storefront: { dispatch_window: null, dispatch_custom_timeframe: null } }, { terms: [], accepted: false }, { fail: 'get_current_lister_terms' }]) {
    const html = await page('app/lister/page.tsx', fixture(input), {}, deps);
    assert.match(html, /Activation requirements/); assert.match(html, /approved product is prepared/);
    assert.doesNotMatch(html, /1 product is live|1 live|Approved and published in the marketplace/);
  }
  const readyHtml = await page('app/lister/page.tsx', fixture(), {}, deps);
  assert.match(readyHtml, /1 product is live/); assert.match(readyHtml, /Dispatch within 4 working days/);
});
test('no active Terms is waiting on HolyHub; available version is actionable', async () => {
  const hold = await page('app/lister/page.tsx', fixture({ terms: [], accepted: false }), {}, deps);
  assert.match(hold, /Waiting for HolyHub.*legal review/);
  const action = await page('app/lister/page.tsx', fixture({ accepted: false }), {}, deps);
  assert.match(action, /Current version needs acceptance/);
});
test('listing stage defaults safely to prepared without an activation result', () => {
  const { ListingStage } = load('components/listing-stage.tsx');
  const html = render(React.createElement(ListingStage, { products: [{ id: 'p', review_status: 'approved', is_published: true }] }));
  assert.match(html, /prepared/); assert.doesNotMatch(html, /product is live/);
});
function adminFixture(custom = {}) {
  const facts = { user_id: 'owner', business_name: 'Fixture shop', category_type: 'Books', dispatch_window: 'working-days', dispatch_custom_timeframe: '4', delivery_charge: 0, ...custom };
  const rows = {
    lister_applications: [{ id: 'application', user_id: 'owner', business_name: 'Fixture shop', category_type: 'Books', status: 'approved' }],
    lister_storefronts: [facts], user_roles: [{ user_id: 'owner' }],
    products: [{ id: 'p', name: 'Prepared product', lister_user_id: 'owner', review_status: 'approved', is_published: true }],
    seller_legal_profiles: [{ user_id: 'owner', verification_status: 'verified' }],
    lister_terms_acceptances: [{ user_id: 'owner', terms_version: current.version, terms_sha256: current.content_sha256 }],
  };
  return { from: table => query({ data: rows[table] ?? [] }), rpc: async () => ({ data: [current] }) };
}
test('admin uses shared readiness and human-readable exact dispatch', async () => {
  const html = await page('app/admin/listers/page.tsx', adminFixture(), {}, deps);
  assert.match(html, /Customer sales ready/); assert.match(html, /Dispatch within 4 working days/);
  assert.match(html, /Seller details:.*Verified/); assert.match(html, /Current version accepted/);
  assert.doesNotMatch(html, />working-days</);
});
test('admin cannot count an empty numeric dispatch token as ready', async () => {
  const html = await page('app/admin/listers/page.tsx', adminFixture({ dispatch_custom_timeframe: '' }), {}, deps);
  assert.match(html, /Dispatch promise needs correcting/); assert.match(html, /Approved \/ hidden until/);
  assert.doesNotMatch(html, /Customer sales ready|Approved \/ live/);
});
test('legal-details links/forms preserve only the fixed onboarding flag', async () => {
  const html = await page('app/lister/legal-details/page.tsx', fixture(), { onboarding: '1' }, deps);
  assert.match(html, /name="onboarding" value="1"/); assert.match(html, /Return to onboarding/);
});
function legalAction(existing, failure = false) {
  const writes = [];
  const { saveSellerLegalProfile } = loadTypescript('app/lister/apply/actions.ts', {
    'next/navigation': { redirect: path => { throw new Error(path); } },
    'next/cache': { revalidatePath() {} },
    '@/lib/auth/require-user': { requireRole: async () => ({ user: { id: 'owner' } }) },
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: () => ({ select(){return this}, eq(){return this}, maybeSingle: async () => ({ data: existing, error: failure ? {} : null }), upsert: async values => { writes.push(values); return { error: null }; } }) }) },
  });
  return { saveSellerLegalProfile, writes };
}
const legalInput = { legal_name: 'LOCAL UNIT FIXTURE', entity_type: 'other', address_line1: 'LOCAL UNIT FIXTURE', city: 'LOCAL', postcode: 'LOCAL', country: 'GB', contact_email: 'fixture@example.invalid' };
function form() { const f = new FormData(); for (const [k,v] of Object.entries(legalInput)) f.set(k,v); f.set('onboarding','1'); return f; }
test('changed verified identity resets review and returns to onboarding', async () => {
  const { saveSellerLegalProfile, writes } = legalAction({ ...legalInput, legal_name: 'OLD LOCAL FIXTURE', verification_status: 'verified' });
  await assert.rejects(saveSellerLegalProfile(form()), /^Error: \/lister\/onboarding$/);
  assert.equal(writes.length, 1); assert.equal(writes[0].verification_status, 'pending'); assert.equal(writes[0].verified_by, null); assert.equal(writes[0].verified_at, null);
});
test('unchanged verified identity preserves verification and still returns to onboarding', async () => {
  const { saveSellerLegalProfile, writes } = legalAction({ ...legalInput, verification_status: 'verified' });
  await assert.rejects(saveSellerLegalProfile(form()), /^Error: \/lister\/onboarding$/); assert.equal(writes.length, 0);
});
test('failed identity save keeps the onboarding flag without false success', async () => {
  const { saveSellerLegalProfile, writes } = legalAction(null, true);
  await assert.rejects(saveSellerLegalProfile(form()), /legal-details\?onboarding=1&error=/); assert.equal(writes.length, 0);
});

test('saved storefront can be revisited with Back without losing activation guidance', async () => {
  const html = await page('app/lister/onboarding/page.tsx', fixture(), {}, { ...deps,
    'next/headers': { cookies: async () => ({ get: () => ({ value: '2:later' }) }) },
    '@/components/storefront-form': { StorefrontForm: () => React.createElement('p', null, 'EDIT EXISTING SHOP') },
  });
  assert.match(html, /EDIT EXISTING SHOP/); assert.match(html, /Activation requirements/);
});
