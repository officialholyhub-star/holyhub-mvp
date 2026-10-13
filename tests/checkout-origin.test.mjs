import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { loadTypescript } from './helpers/load-typescript.mjs';
const { checkoutRedirectUrls } = loadTypescript('lib/checkout-origin.ts');

function urls(env, headers) {
  const previous = { ...process.env };
  try {
    delete process.env.CODESPACE_NAME;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    Object.assign(process.env, env);
    return checkoutRedirectUrls(new Headers(headers));
  } finally {
    for (const key of ['NODE_ENV', 'CODESPACE_NAME', 'NEXT_PUBLIC_SITE_URL']) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
}
const dev = { NODE_ENV: 'development', CODESPACE_NAME: 'current-space', NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' };

test('Codespaces forwarded host overrides the bad localhost Origin and stale configuration', () => {
  const result = urls(dev, { 'x-forwarded-host': 'current-space-3000.app.github.dev', host: 'localhost:3000', origin: 'http://localhost:3000', 'x-forwarded-proto': 'http' });
  assert.equal(result.success_url, 'https://current-space-3000.app.github.dev/checkout/success?session_id={CHECKOUT_SESSION_ID}');
  assert.equal(result.cancel_url, 'https://current-space-3000.app.github.dev/checkout/cancelled');
});
test('local development derives its actual port without a configured URL', () => {
  assert.equal(urls({ NODE_ENV: 'development' }, { host: 'localhost:3456' }).cancel_url, 'http://localhost:3456/checkout/cancelled');
});
test('production ignores request-controlled redirect destinations', () => {
  const env = { NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://app.holyhub.co.uk/path/' };
  assert.equal(urls(env, { origin: 'https://evil.example', 'x-forwarded-host': 'evil.example' }).cancel_url, 'https://app.holyhub.co.uk/checkout/cancelled');
});
test('untrusted development hosts fall back to the configured public origin', () => {
  const env = { ...dev, NEXT_PUBLIC_SITE_URL: 'https://configured.example/' };
  for (const host of ['other-space-3000.app.github.dev', 'current-space-3000.app.github.dev.evil.example', '0.0.0.0:3000', 'localhost:3000']) {
    assert.equal(urls(env, { 'x-forwarded-host': host, origin: 'https://evil.example' }).cancel_url, 'https://configured.example/checkout/cancelled');
  }
});
test('missing and invalid deployment URLs fail closed', () => {
  for (const value of [undefined, 'javascript:alert(1)', 'https://user:pass@example.com', 'http://0.0.0.0:3000']) {
    const env = { NODE_ENV: 'production' };
    if (value) env.NEXT_PUBLIC_SITE_URL = value;
    assert.throws(() => urls(env, {}));
  }
});
test('both generated checkout destinations have app routes', () => {
  for (const route of ['success', 'cancelled']) assert.ok(fs.existsSync(`app/checkout/${route}/page.tsx`));
});
