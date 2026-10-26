import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { loadTypescript } from './helpers/load-typescript.mjs';

function setup(options = {}) {
  const calls = [];
  let level = options.level ?? 'aal1';
  let methods = options.methods ?? (level === 'aal2' ? [{ method: 'totp' }] : [{ method: 'password' }]);
  let factors = options.factors ?? [];
  const verifiedFactor = { id: 'primary', factor_type: 'totp', status: 'verified', friendly_name: 'Primary' };
  const auth = {
    getUser: async () => ({ data: { user: options.signedOut ? null : { id: 'admin-user' } }, error: null }),
    getSession: async () => ({ data: { session: options.noSession ? null : { access_token: 'cookie-access-token' } }, error: null }),
    mfa: {
      getAuthenticatorAssuranceLevel: async token => {
        calls.push(['assurance', token]);
        assert.equal(token, 'cookie-access-token', 'must validate the cookie token remotely');
        return { data: { currentLevel: level, nextLevel: factors.some(f => f.status === 'verified') ? 'aal2' : level, currentAuthenticationMethods: methods }, error: options.assuranceError };
      },
      listFactors: async () => ({ data: { all: factors, totp: factors.filter(f => f.factor_type === 'totp' && f.status === 'verified') }, error: options.factorError }),
      enroll: async input => { calls.push(['enroll', input]); factors = [...factors, { id: 'new', factor_type: 'totp', status: 'unverified' }]; return { data: { id: 'new', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>', secret: 'test-only-secret' } }, error: options.enrollError }; },
      challenge: async input => { calls.push(['challenge', input]); return { data: { id: 'challenge-1' }, error: options.challengeError }; },
      verify: async input => {
        calls.push(['verify', input]);
        if (options.wrongCode) return { error: { message: 'invalid code' } };
        factors = factors.map(f => f.id === input.factorId ? { ...f, status: 'verified' } : f);
        if (!options.stuckAal1) { level = 'aal2'; methods = [{ method: 'totp' }]; }
        return { data: {}, error: null };
      },
    },
  };
  const supabase = { auth, from(table) {
    calls.push(['table', table]);
    return { select() { return this; }, eq() { return this; }, async maybeSingle() {
      return table === 'profiles' ? { data: { account_status: options.blocked ? 'blocked' : 'active' }, error: options.profileError }
        : { data: options.nonAdmin ? null : { role: 'admin' }, error: options.roleError };
    } };
  } };
  const deps = {
    '@/lib/supabase/server': { createClient: async () => supabase },
    'next/headers': { headers: async () => new Headers({ 'x-holyhub-request-path': options.path ?? '/admin/products?status=pending' }) },
    'next/navigation': { redirect: location => { throw Object.assign(new Error('redirect'), { location }); } },
    'next/cache': { revalidatePath: path => calls.push(['revalidate', path]) },
  };
  const guard = loadTypescript('lib/auth/require-user.ts', deps);
  const actions = loadTypescript('app/auth/mfa/actions.ts', { ...deps, '@/lib/auth/require-user': guard });
  return { guard, actions, calls, deps, supabase, verifiedFactor };
}
async function redirected(promise, expected) {
  await assert.rejects(promise, error => { assert.equal(error.location, expected); return true; });
}
const form = (values = {}) => { const f = new FormData(); for (const [key, value] of Object.entries({ factor_id: 'primary', code: '123456', next: '/admin/products', ...values })) f.set(key, value); return f; };
const primary = { id: 'primary', factor_type: 'totp', status: 'verified' };

test('customers and listers at AAL1 never invoke MFA checks', async () => {
  for (const role of ['customer', 'lister']) {
    const { guard, calls } = setup();
    await guard.requireRole(role);
    assert.equal(calls.some(c => c[0] === 'assurance'), false);
  }
});
test('signed-out, inactive and non-admin users cannot enter MFA or admin', async () => {
  for (const options of [{ signedOut: true }, { blocked: true }, { nonAdmin: true }]) {
    const { guard, actions, calls } = setup(options);
    for (const invoke of [() => guard.requireRole('admin'), () => guard.requireAdminMfaIdentity(), () => actions.enrollAdminTotp(), () => actions.verifyAdminTotp({}, form())]) {
      await assert.rejects(invoke(), e => Boolean(e.location));
    }
    assert.equal(calls.some(c => c[0] === 'enroll' || c[0] === 'verify' || c[0] === 'assurance'), false);
  }
});
test('AAL1 admin without verified TOTP is sent to setup; unverified/phone factors do not count', async () => {
  for (const factors of [[], [{ id: 'pending', factor_type: 'totp', status: 'unverified' }], [{ id: 'phone', factor_type: 'phone', status: 'verified' }]]) {
    const { guard } = setup({ factors });
    await redirected(guard.requireRole('admin'), '/auth/mfa/setup?next=%2Fadmin%2Fproducts%3Fstatus%3Dpending');
  }
});
test('existing TOTP factor at AAL1 requires challenge, despite nextLevel AAL2', async () => {
  const { guard } = setup({ factors: [primary] });
  await redirected(guard.requireRole('admin'), '/auth/mfa/challenge?next=%2Fadmin%2Fproducts%3Fstatus%3Dpending');
});
test('only server-validated AAL2 via TOTP grants admin access', async () => {
  const { guard } = setup({ level: 'aal2', factors: [primary] });
  await guard.requireRole('admin');
  for (const options of [{ assuranceError: {} }, { factorError: {} }, { noSession: true }]) {
    await assert.rejects(setup(options).guard.requireRole('admin'), /could not be verified/);
  }
  await assert.rejects(setup({ level: 'aal2', factors: [primary], methods: [{ method: 'mfa/phone' }] }).guard.requireRole('admin'), e => e.location.includes('/challenge'));
});
test('every admin subpage at AAL1 is gated with its safe destination', async () => {
  for (const path of ['/admin', '/admin/orders', '/admin/products', '/admin/listers', '/admin/applications', '/admin/analytics', '/admin/payments', '/admin/security']) {
    const { guard } = setup({ path });
    await redirected(guard.requireRole('admin'), `/auth/mfa/setup?next=${encodeURIComponent(path)}`);
  }
});
test('enrollment returns QR/manual key only after role validation and never removes factors', async () => {
  const { actions, calls } = setup();
  const result = await actions.enrollAdminTotp();
  assert.equal(result.enrollment.factorId, 'new');
  assert.match(result.enrollment.qrCode, /^data:image/);
  assert.equal(result.enrollment.secret, 'test-only-secret');
  assert.equal(calls.find(c => c[0] === 'enroll')[1].factorType, 'totp');
});
test('an existing-factor AAL1 admin cannot add or bootstrap a backup', async () => {
  const { actions, calls } = setup({ factors: [primary, { id: 'new', factor_type: 'totp', status: 'unverified' }] });
  await redirected(actions.enrollAdminTotp(), '/auth/mfa/challenge?next=%2Fadmin%2Fsecurity');
  assert.ok((await actions.verifyAdminTotp({}, form({ factor_id: 'new' }))).error);
  assert.equal(calls.some(c => ['enroll', 'challenge', 'verify'].includes(c[0])), false);
});
test('first enrollment verifies, upgrades the session and preserves next', async () => {
  const { actions, guard, calls } = setup();
  await actions.enrollAdminTotp();
  await redirected(actions.verifyAdminTotp({}, form({ factor_id: 'new' })), '/admin/products');
  await guard.requireRole('admin');
  const v = calls.find(c => c[0] === 'verify')[1];
  assert.equal(v.challengeId, 'challenge-1');
  assert.equal(v.factorId, 'new');
  assert.ok(calls.filter(c => c[0] === 'assurance').length >= 4);
});
test('existing factor challenge upgrades AAL1 and supports backup selection', async () => {
  const { actions, guard } = setup({ factors: [primary, { ...primary, id: 'backup' }] });
  await redirected(actions.verifyAdminTotp({}, form({ factor_id: 'backup' })), '/admin/products');
  await guard.requireRole('admin');
});
test('AAL2 admin can enroll and verify a backup without deleting the primary', async () => {
  const { actions, calls } = setup({ factors: [primary], level: 'aal2' });
  await actions.enrollAdminTotp();
  await redirected(actions.verifyAdminTotp({}, form({ factor_id: 'new' })), '/admin/products');
  assert.equal(calls.some(c => c[0] === 'unenroll'), false);
});
test('bad code, factor ownership, challenge errors and failed upgrade fail closed', async () => {
  for (const options of [{ wrongCode: true }, { challengeError: {} }, { stuckAal1: true }]) {
    const { actions } = setup({ factors: [primary], ...options });
    assert.ok((await actions.verifyAdminTotp({}, form())).error);
  }
  for (const values of [{ factor_id: 'another-users-factor' }, { code: 'abc123' }, { code: '12345' }]) {
    const { actions, calls } = setup({ factors: [primary] });
    assert.ok((await actions.verifyAdminTotp({}, form(values))).error);
    assert.equal(calls.some(c => c[0] === 'verify'), false);
  }
});
test('return paths cannot be external, auth loops, encoded authority or non-admin destinations', async () => {
  const { adminNextPath } = loadTypescript('lib/auth/admin-mfa.ts');
  for (const next of ['https://evil.test', '//evil.test', '/\\evil.test', '/auth/mfa/setup', '/account', '/admin/../../evil', '/%2f%2fevil.test', '/administer', '/\nevil.test']) {
    assert.equal(adminNextPath(next), '/admin', next);
    const { actions } = setup({ factors: [primary] });
    await redirected(actions.verifyAdminTotp({}, form({ next })), '/admin');
  }
  assert.equal(adminNextPath('/admin/products?status=pending'), '/admin/products?status=pending');
});
test('all current admin mutation entrypoints stop AAL1 before privileged work', async () => {
  for (const [file, action] of [['app/admin/actions.ts', 'reviewProductListing'], ['app/admin/applications/actions.ts', 'reviewListerApplication'], ['app/admin/listers/actions.ts', 'verifySellerLegalProfile'], ['app/admin/payments/actions.ts', 'managePayments']]) {
    const { guard, deps } = setup();
    let privileged = 0;
    const actions = loadTypescript(file, { ...deps, '@/lib/auth/require-user': guard,
      '@/lib/supabase/admin': { createAdminClient: () => { privileged++; throw new Error('privileged call'); } },
      '@/lib/stripe': { getStripe: () => { privileged++; throw new Error('stripe call'); } },
      '@/lib/payment-operations': {},
    });
    await assert.rejects(actions[action](form()), e => e.location.includes('/auth/mfa/setup'));
    assert.equal(privileged, 0, file);
  }
});
test('every admin page/action retains the shared guard and bootstrap guard is confined to MFA', () => {
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(f => f.isDirectory() ? walk(`${dir}/${f.name}`) : [`${dir}/${f.name}`]);
  for (const file of walk('app/admin').filter(f => /(?:page\.tsx|actions\.ts|route\.ts)$/.test(f))) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /await requireRole\("admin"\)/, file);
    assert.doesNotMatch(source, /requireAdminMfaIdentity/, file);
  }
});
test('a new ordinary login after logout requires another MFA challenge', async () => {
  await setup({ level: 'aal2', factors: [primary] }).guard.requireRole('admin');
  await assert.rejects(setup({ level: 'aal1', factors: [primary] }).guard.requireRole('admin'), e => e.location.includes('/challenge'));
});
