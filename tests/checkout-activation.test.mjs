import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypescript } from './helpers/load-typescript.mjs';
import { query } from './helpers/render-progress.mjs';
const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
async function checkout({ role = 'customer', gate = '', seller = 'b', result = false, identity = true, throws = false } = {}) {
  let stripeCalls = 0;
  const products = ids.map((id, i) => ({ id, name: 'Product', price: 10, currency: 'GBP', lister_user_id: i ? 'b' : 'a', is_published: true, review_status: 'approved', category_type: 'Books', stock_quantity: 5, product_variants: [] }));
  const supabase = {
    from: table => query({ data: table === 'products' ? products : ['a', 'b'].map(user_id => ({ user_id, delivery_country: 'GB', delivery_option: 'free' })), error: null }),
    rpc: async (name, { p_user_id }) => {
      if (name === gate && p_user_id === seller) {
        if (throws) throw new Error('lookup failed');
        return { data: result, error: result === 'error' ? { code: 'unavailable' } : null };
      }
      return { data: true, error: null };
    },
  };
  const { startCheckout } = loadTypescript('app/checkout/actions.ts', {
    'next/navigation': { redirect: url => { throw new Error(`redirect:${url}`); } },
    'next/cache': { revalidatePath() {} }, 'next/headers': { headers: async () => new Headers() },
    '@/lib/auth/require-user': { requireUser: async () => ({ supabase, user: { id: role } }) },
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: () => query({ data: identity ? ['a', 'b'].map(user_id => ({ user_id, verification_status: 'verified' })) : [], error: null }) }) },
    '@/lib/seller-legal': { SELLER_LEGAL_FIELDS: '*', sellerLegalProfileComplete: () => identity },
    '@/lib/checkout-origin': { checkoutRedirectUrls: () => ({}) },
    '@/lib/stripe': { getStripe: () => ({ checkout: { sessions: { create: async args => { stripeCalls++; assert.equal(args.metadata.holyhub_product_subtotal, '2000'); assert.equal(args.metadata.holyhub_commission, '100'); throw new Error('mock Stripe boundary'); } } } }) },
  });
  const form = new FormData(); form.set('accept_terms', 'on'); form.set('basket', JSON.stringify(ids.map(id => ({ id, quantity: 1 }))));
  for (const [key,value] of Object.entries({delivery_recipient_name:'Recipient',delivery_address_line1:'10 Test Road',delivery_city:'London',delivery_postcode:'SW1A 1AA',delivery_country:'GB'})) form.set(key,value);
  await assert.rejects(startCheckout(form));
  return stripeCalls;
}
for (const role of ['customer', 'lister', 'admin']) {
  test(`${role}: identity failure blocks Stripe`, async () => assert.equal(await checkout({ role, identity: false }), 0));
  for (const gate of ['seller_dispatch_is_ready', 'seller_terms_are_current']) {
    for (const result of [false, null, 'true', 'error']) test(`${role}: ${gate} ${result} on second seller blocks entire basket`, async () => assert.equal(await checkout({ role, gate, result }), 0));
    test(`${role}: thrown ${gate} fails before Stripe`, async () => assert.equal(await checkout({ role, gate, throws: true }), 0));
  }
}
test('all sellers positively verified reach mocked Stripe with preserved commission', async () => assert.equal(await checkout(), 1));
