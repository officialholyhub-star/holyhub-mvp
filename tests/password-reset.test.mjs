import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypescript } from './helpers/load-typescript.mjs';

process.env.AUTH_RECOVERY_SECRET = 'test-only-secret-not-used-by-the-application';
const recovery = loadTypescript('lib/auth/recovery.ts');
const { authOrigin } = loadTypescript('lib/auth/origin.ts');
const EMAIL = 'person@example.com';
function setup({ user = { id: 'user-1' }, proof = true, requestError = null, updateError = null, callbackError = null } = {}) {
  const calls = [];
  const jar = new Map(proof ? [[recovery.RECOVERY_COOKIE, recovery.createRecoveryProof('user-1')]] : []);
  const auth = {
    getUser: async () => ({ data: { user } }),
    resetPasswordForEmail: async (...args) => { calls.push(['send', ...args]); return { error: requestError }; },
    updateUser: async (...args) => { calls.push(['update', ...args]); return { error: updateError }; },
    signOut: async () => { calls.push(['signOut']); return { error: null }; },
    signInWithPassword: async () => ({ error: null }),
    signUp: async () => ({ data: { session: {} }, error: null }),
    exchangeCodeForSession: async code => { calls.push(['exchange', code]); return { data: { user }, error: callbackError }; },
    verifyOtp: async options => { calls.push(['verify', options]); return { data: { user }, error: callbackError }; },
  };
  const dependencies = {
    '@/lib/supabase/server': { createClient: async () => ({ auth }) },
    'next/headers': { headers: async () => new Headers(), cookies: async () => ({ get: key => jar.has(key) ? { value: jar.get(key) } : undefined, set: (key, value, options) => { assert.equal(options.path, "/auth"); if (options.maxAge === 0) jar.delete(key); else jar.set(key, value); } }) },
    'next/navigation': { redirect: location => { throw Object.assign(new Error('redirect'), { location }); } },
    'next/cache': { revalidatePath() {} },
    'next/server': { NextResponse: { redirect: location => ({ location: String(location), cookies: { set: (...args) => calls.push(['cookie', ...args]) } }) } },
  };
  return { actions: loadTypescript('app/auth/actions.ts', dependencies), callback: loadTypescript('app/auth/callback/route.ts', dependencies), calls, jar };
}
async function destination(action, values) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  try { await action(data); assert.fail('Expected redirect'); } catch (error) { if (!error.location) throw error; return new URL(error.location, 'http://localhost:3000'); }
}
const passwords = { password: 'new-password-123', confirm_password: 'new-password-123' };

test('reset validates email, sends via Supabase with callback, and shows neutral confirmation', async () => {
  const { actions, calls } = setup();
  assert.equal((await destination(actions.requestPasswordReset, { email: '' })).searchParams.get('error'), 'Enter a valid email address.');
  assert.equal((await destination(actions.requestPasswordReset, { email: 'invalid' })).searchParams.get('error'), 'Enter a valid email address.');
  assert.equal(calls.length, 0);
  const result = await destination(actions.requestPasswordReset, { email: EMAIL });
  assert.equal(result.searchParams.get('message'), 'We’ve sent you a password reset link. Check your inbox and spam folder.');
  assert.equal(calls[0][1], EMAIL);
  const target = new URL(calls[0][2].redirectTo);
  assert.equal(target.pathname, '/auth/callback');
  assert.equal(target.searchParams.get('next'), '/auth/reset-password');
  await destination(actions.requestPasswordReset, { email: EMAIL });
  assert.equal(calls.filter(call => call[0] === 'send').length, 2);
});
test('send failures show a useful error', async () => {
  const { actions } = setup({ requestError: { code: 'over_email_send_rate_limit' } });
  assert.equal((await destination(actions.requestPasswordReset, { email: EMAIL })).searchParams.get('error'), 'We couldn’t send the reset email. Please try again.');
});
test('password validation preserves proof and never calls update for invalid input', async () => {
  const { actions, calls, jar } = setup();
  assert.equal((await destination(actions.updatePassword, { ...passwords, password: 'short' })).searchParams.get('error'), 'Your password must be at least 12 characters.');
  assert.equal((await destination(actions.updatePassword, { ...passwords, confirm_password: 'different' })).searchParams.get('error'), 'Your passwords don’t match.');
  assert.equal(calls.length, 0);
  assert.ok(jar.has(recovery.RECOVERY_COOKIE));
});
test('ordinary sessions and missing sessions cannot bypass the email link', async () => {
  for (const options of [{ proof: false }, { user: null }]) {
    const { actions, calls } = setup(options);
    assert.equal((await destination(actions.updatePassword, passwords)).searchParams.get('error'), recovery.INVALID_RECOVERY_LINK);
    assert.equal(calls.length, 0);
  }
});
test('success updates, removes proof, signs out and returns to login with success', async () => {
  const { actions, calls, jar } = setup();
  const result = await destination(actions.updatePassword, passwords);
  assert.equal(result.pathname, '/auth/login');
  assert.equal(result.searchParams.get('message'), 'Your password has been updated.');
  assert.equal(calls[0][0], 'update');
  assert.equal(calls[0][1].password, passwords.password);
  assert.equal(calls[1][0], 'signOut');
  assert.equal(jar.size, 0);
  assert.equal((await destination(actions.updatePassword, passwords)).pathname, '/auth/forgot-password');
});
test('update handles expired sessions, same password and retryable failures', async () => {
  for (const [error, expected] of [[{ status: 401 }, recovery.INVALID_RECOVERY_LINK], [{ code: 'same_password' }, 'Choose a different password from your current password.'], [{ status: 500 }, 'We couldn’t update your password. Please try again.']]) {
    const { actions } = setup({ updateError: error });
    assert.equal((await destination(actions.updatePassword, passwords)).searchParams.get('error'), expected);
  }
});
test('callback verifies PKCE or recovery token before issuing proof', async () => {
  for (const query of ['code=real-code&next=/auth/reset-password', 'token_hash=real-hash&type=recovery']) {
    const { callback, calls } = setup();
    const url = new URL(`http://localhost:3000/auth/callback?${query}`);
    const result = await callback.GET({ url: url.href, nextUrl: url, headers: new Headers() });
    assert.equal(new URL(result.location).pathname, '/auth/reset-password');
    assert.ok(['exchange', 'verify'].includes(calls[0][0]));
    const cookie = calls.find(call => call[0] === 'cookie');
    assert.ok(recovery.hasRecoveryProof(cookie[2], 'user-1'));
    assert.equal(cookie[3].httpOnly, true);
  }
});
test('invalid callback cannot issue recovery proof even with an existing login', async () => {
  for (const [query, options] of [['next=/auth/reset-password', {}], ['error_code=otp_expired&next=/auth/reset-password', {}], ['code=used-code&next=/auth/reset-password', { callbackError: { code: 'invalid_grant' } }]]) {
    const { callback, calls } = setup(options);
    const url = new URL(`http://localhost:3000/auth/callback?${query}`);
    const result = await callback.GET({ url: url.href, nextUrl: url, headers: new Headers() });
    assert.equal(new URL(result.location).searchParams.get('error'), recovery.INVALID_RECOVERY_LINK);
    assert.ok(!calls.some(call => call[0] === 'cookie' && call[2]));
  }
});
test('proof rejects tampering, other users and expiry', () => {
  const proof = recovery.createRecoveryProof('user-1');
  assert.equal(recovery.hasRecoveryProof(proof, 'user-1'), true);
  assert.equal(recovery.hasRecoveryProof(proof, 'user-2'), false);
  assert.equal(recovery.hasRecoveryProof(proof.replace('user-1', 'user-2'), 'user-2'), false);
  assert.equal(recovery.hasRecoveryProof('user-1.1.' + 'a'.repeat(64), 'user-1'), false);
});
test('development origins override stale config; production uses configured domain', () => {
  const oldMode = process.env.NODE_ENV;
  const oldSite = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://app.holyhub.co.uk';
    assert.equal(authOrigin(new Headers({ 'x-forwarded-host': 'my-codespace-3000.app.github.dev' })), 'https://my-codespace-3000.app.github.dev');
    assert.equal(authOrigin(new Headers({ host: 'localhost:3001' })), 'http://localhost:3001');
    process.env.NODE_ENV = 'production';
    assert.equal(authOrigin(new Headers({ 'x-forwarded-host': 'attacker.example' })), 'https://app.holyhub.co.uk');
  } finally {
    if (oldMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldMode;
    if (oldSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = oldSite;
  }
});
test('existing login redirects and signup returns account destination for welcome', async () => {
  const { actions } = setup();
  assert.equal((await destination(actions.login, { email: EMAIL, password: 'existing-password' })).pathname, '/account');
  const data = new FormData();
  Object.entries({ full_name: 'Alex', email: EMAIL, ...passwords, confirm_age_18: 'on', accept_terms: 'on' }).forEach(([key, value]) => data.set(key, value));
  assert.equal((await actions.signup(data)).next, '/account');
});
