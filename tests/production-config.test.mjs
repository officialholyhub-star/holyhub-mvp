import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { productionConfigErrors, checkHostedServices } from '../scripts/production-config.mjs';

const config = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuv',
  NEXT_PUBLIC_SITE_URL: 'https://app.holyhub.co.uk',
};
test('the configured deployment runs the hosted readiness gate before building', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const hosting = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(hosting.buildCommand, 'npm run build:production');
  assert.equal(manifest.scripts['build:production'], 'node scripts/check-production.mjs && next build');
  assert.equal(manifest.scripts.build, 'next build'); // Isolated CI remains independent of production.
});

test('hosted readiness rejects network failures and malformed provider responses', async () => {
  const requests = [
    async () => { throw new Error('Network unavailable'); },
    async () => new Response('unavailable', { status: 503 }),
    async () => new Response('not JSON', { status: 200 }),
    async () => Response.json(null),
    async () => Response.json({ schema_version: 8, schema_ready: 'true', storage_ready: 'true', admin_ready: 'true' }),
  ];
  for (const request of requests) {
    const checks = await checkHostedServices(config, request);
    assert.ok(checks.length > 0);
    assert.ok(checks.some(check => !check.ok));
  }
});
test('production preflight accepts only a real hosted configuration and never demo mode', () => {
  assert.deepEqual(productionConfigErrors(config), []);
  for (const change of [
    { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54330' },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' },
    { NEXT_PUBLIC_SITE_URL: 'http://app.holyhub.co.uk' },
    { NEXT_PUBLIC_SITE_URL: 'https://app.holyhub.co.uk/other' },
    { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_do_not_expose' },
    { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'placeholder' },
    { HOLYHUB_LOCAL_DEMO: 'true' },
    { HOLYHUB_DEMO_SAMPLE_DATA: 'true' },
    { HOLYHUB_STRIPE_WEBHOOKS_ENABLED: 'true' },
  ]) assert.ok(productionConfigErrors({ ...config, ...change }).length);
});
test('production checks fail closed for missing migrations, storage, admin or email confirmation', async () => {
  const db = { schema_version: 8, schema_ready: true, storage_ready: true, admin_ready: true };
  const auth = { disable_signup: false, mailer_autoconfirm: false, external: { email: true } };
  const request = (database, settings) => async url => Response.json(url.includes('/rpc/') ? database : settings);
  assert.ok((await checkHostedServices(config, request(db, auth))).every(check => check.ok));
  for (const field of ['schema_ready','storage_ready','admin_ready']) {
    assert.ok((await checkHostedServices(config, request({ ...db, [field]: false }, auth))).some(check => !check.ok));
  }
  assert.ok((await checkHostedServices(config, request(db, { ...auth, mailer_autoconfirm: true }))).some(check => !check.ok));
  assert.ok((await checkHostedServices(config, async () => new Response('{}', { status: 404 }))).every(check => !check.ok));
});
