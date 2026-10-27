import assert from 'node:assert/strict';
import { loadTypescript } from './helpers/load-typescript.mjs';

let payload;
let response = { data: { user: { id: 'customer' }, session: {} }, error: null };
const { signup, login, resendSignupConfirmation } = loadTypescript('app/auth/actions.ts', {
  'next/navigation': { redirect: url => { throw new Error(`REDIRECT:${url}`); } },
  'next/cache': { revalidatePath() {} },
  'next/headers': { headers: async () => ({}), cookies: async () => ({}) },
  '@/lib/supabase/server': { createClient: async () => ({ auth: {
    signUp: async input => { payload = input; return response; },
    signInWithPassword: async () => ({ error: null }),
    resend: async input => { payload = input; return { error: null }; },
  } }) },
  '@/lib/auth/origin': { authOrigin: () => 'https://holyhub.test' },
  '@/lib/auth/recovery': {},
});
function form(overrides = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ full_name: 'Alex', email: 'alex@example.test', password: 'abcdefghijkl', confirm_password: 'abcdefghijkl', accept_terms: 'on', ...overrides })) data.set(key, value);
  return data;
}
assert.match((await signup(form({ password: 'abcdefghijk' }))).error, /12/);
assert.match((await signup(form({ accept_terms: '' }))).error, /terms/);
assert.match((await signup(form({ confirm_password: 'differentpassword' }))).error, /match/);
assert.match((await signup(form({ full_name: '' }))).error, /first name/);
assert.match((await signup(form({ password: 'x'.repeat(129) }))).error, /128/);
assert.equal((await signup(form())).next, '/account');
assert.deepEqual(JSON.parse(JSON.stringify(payload.options.data)), { full_name: 'Alex', customer_setup_complete: false });
await signup(form({ faith: 'sensitive-value', interests: 'sensitive-value', marketing: 'on' }));
assert.equal(JSON.stringify(payload).includes('sensitive-value'), false);
assert.equal(JSON.stringify(payload).includes('marketing'), false);
response = { data: { user: { id: 'obfuscated' }, session: null }, error: null };
const confirmation = await signup(form({ customer_setup_complete: 'true', faith: 'private-answer', interests: 'private-interests' }));
assert.equal(payload.options.data.customer_setup_complete, true);
assert.equal(payload.options.emailRedirectTo, 'https://holyhub.test/auth/callback?next=/account');
assert.equal(JSON.stringify(payload).includes('private-'), false);
assert.equal(confirmation.next, '/auth/check-email');
assert.equal(confirmation.userId, undefined);
response = { data: {}, error: { message: 'sensitive-provider-detail' } };
assert.equal((await signup(form())).error.includes('sensitive-provider-detail'), false);
await assert.rejects(login(form({ password: 'oldshort' })), /REDIRECT:\/account/);
console.log('PASS signup server validation, optional data exclusion, confirmation branch, provider errors and existing short-password login');

await assert.rejects(resendSignupConfirmation(form()), /REDIRECT:\/auth\/check-email\?message=/);
assert.equal(payload.type, 'signup');
assert.equal(payload.options.emailRedirectTo, 'https://holyhub.test/auth/callback?next=/account');
assert.equal(payload.options.data, undefined);
await assert.rejects(login(form({ next: '//evil.test' })), /REDIRECT:\/account/);
await assert.rejects(login(form({ next: '/lister' })), /REDIRECT:\/lister/);
console.log('PASS durable completion metadata, no answer storage, resend and safe login destinations');
