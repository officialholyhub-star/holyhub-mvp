// Actual Next.js pages, compiled CSS, Server Action, cookies and routing.
// A temporary source copy uses a loopback-only auth/API fixture: no live signup/database access.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { cpSync, mkdtempSync, symlinkSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
const directory = process.env.HOLYHUB_BROWSER_TOOLS_DIR || '/tmp/holyhub-onboarding-tools';
const { chromium } = createRequire(path.join(directory, 'package.json'))('playwright');
const root = mkdtempSync('/tmp/hh-welcome-real-');
const output = path.join(directory, 'real-welcome-results');
mkdirSync(output, { recursive: true });
for (const file of ['app', 'components', 'lib', 'public', 'next.config.ts', 'tsconfig.json', 'package.json', 'package-lock.json', 'next-env.d.ts', 'proxy.ts']) {
  cpSync(path.resolve(file), path.join(root, file), { recursive: true });
}
// Only the temporary test copy needs this root for its external node_modules symlink.
writeFileSync(path.join(root, 'next.config.ts'), readFileSync(path.join(root, 'next.config.ts'), 'utf8').replace('const nextConfig: NextConfig = {', 'const nextConfig: NextConfig = { turbopack: { root: "/" },'));
symlinkSync(path.resolve('node_modules'), path.join(root, 'node_modules'), 'dir');
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'welcome@example.test', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { full_name: 'Alex' }, created_at: new Date().toISOString() };
const jwt = [{ alg: 'HS256', typ: 'JWT' }, { sub: user.id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) }].map(v => Buffer.from(JSON.stringify(v)).toString('base64url')).join('.') + '.fake';
let signups = 0;
const stub = createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json');
  if (request.url.startsWith('/auth/v1/signup')) {
    let body = '';
    for await (const chunk of request) body += chunk;
    const input = JSON.parse(body);
    assert.deepEqual(input.data, { full_name: 'Alex' });
    signups++;
    if (input.email.startsWith('error')) { response.statusCode = 422; response.end(JSON.stringify({ msg: 'Fixture failure' })); }
    else response.end(JSON.stringify(input.email.startsWith('confirm') ? user : { access_token: jwt, token_type: 'bearer', expires_in: 3600, refresh_token: 'fixture-refresh', user }));
  } else if (request.url.startsWith('/auth/v1/user')) response.end(JSON.stringify(user));
  else if (request.url.startsWith('/rest/v1/')) response.end('[]');
  else { response.statusCode = 404; response.end('{}'); }
});
await new Promise(resolve => stub.listen(0, '127.0.0.1', resolve));
const port = Number(process.env.HOLYHUB_WELCOME_TEST_PORT || 3100);
const origin = `http://localhost:${port}`;
const next = spawn(path.resolve('node_modules/.bin/next'), ['dev', '--port', String(port)], {
  cwd: root,
  env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${stub.address().port}`, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-only-key', NEXT_PUBLIC_SITE_URL: origin },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
next.stdout.on('data', data => { serverOutput += data; });
next.stderr.on('data', data => { serverOutput += data; });
const browser = await chromium.launch({ headless: true });
try {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (next.exitCode !== null) throw new Error(serverOutput);
    try { const response = await fetch(`${origin}/auth/signup`); if (response.ok) break; } catch { /* Wait for local server readiness. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  for (const width of [390, 1440]) for (const motion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: motion });
    const page = await context.newPage();
    // Reproduce a slow route load: welcome must stay visible until navigation commits.
    if (width === 390 && motion === 'no-preference') await page.route(`${origin}/marketplace**`, async route => {
      await new Promise(resolve => setTimeout(resolve, 1800));
      await route.continue();
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/auth/signup`);
    assert.equal(await page.getByText('Your answers stay on this screen', { exact: false }).count(), 0);
    await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
    await page.getByRole('heading', { name: 'What does your faith journey currently look like?', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
    await page.getByRole('heading', { name: 'Join HolyHub', exact: true }).waitFor();
    for (const [name, value] of [['First name', 'Alex'], ['Email', 'error@example.test'], ['Password', 'abcdefghijkl'], ['Confirm password', 'abcdefghijkl']]) await page.getByLabel(name, { exact: true }).fill(value);
    await page.getByLabel('I agree to').check();
    await page.getByRole('button', { name: 'Create my account' }).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.locator('[data-celebration]').count(), 0);
    await page.getByLabel('Email', { exact: true }).fill(motion === 'reduce' ? 'confirm@example.test' : 'welcome@example.test');
    await page.getByRole('button', { name: 'Create my account' }).click();
    const welcome = page.locator('[data-celebration]');
    await page.getByRole('heading', { name: 'Welcome to HolyHub 💙', exact: true }).waitFor();
    const paintedAt = Date.now();
    assert.equal(await welcome.getByText('Connect. Discover. Grow.', { exact: true }).isVisible(), true);
    await page.locator(`[data-celebration=${motion === 'reduce' ? 'reduced' : 'falling'}]`).waitFor();
    const bounds = await welcome.boundingBox();
    assert.equal(bounds.x, 0); assert.equal(bounds.y, 0); assert.equal(bounds.width, width); assert.equal(bounds.height, 900);
    await page.waitForTimeout(650);
    const particles = welcome.locator('i');
    if (motion === 'reduce') {
      assert.equal(await particles.count(), 0);
      assert.equal(await welcome.evaluate(node => node.getAnimations({ subtree: true }).length), 0);
    } else {
      assert.equal(await particles.count(), 84);
      const positions = await particles.evaluateAll(nodes => nodes.map(node => ({ top: node.getBoundingClientRect().top, animation: getComputedStyle(node).animationName })));
      assert.ok(positions.filter(p => p.top >= 0 && p.top < 900).length >= 35, 'confetti visibly enters viewport');
      assert.ok(positions.every(p => p.animation !== 'none'));
      const before = await particles.first().boundingBox();
      await page.waitForTimeout(250);
      const after = await particles.first().boundingBox();
      assert.ok(after.y > before.y + 30, 'confetti actually falls in compiled Next CSS');
    }
    await page.screenshot({ path: path.join(output, `welcome-${width}-${motion}.png`) });
    await page.locator('[data-celebration=complete]').waitFor();
    assert.equal(new URL(page.url()).pathname, '/auth/signup');
    assert.equal(await welcome.evaluate(node => getComputedStyle(node).opacity), '1', 'welcome stays visible after confetti completes');
    await page.screenshot({ path: path.join(output, `complete-${width}-${motion}.png`) });
    if (width === 390 && motion === 'no-preference') {
      await page.waitForTimeout(Math.max(0, 4500 - (Date.now() - paintedAt)));
      assert.equal(new URL(page.url()).pathname, '/auth/signup');
      assert.equal(await welcome.evaluate(node => getComputedStyle(node).opacity), '1', 'slow destination does not hide welcome');
    }
    await page.waitForURL(`${origin}${motion === 'reduce' ? '/auth/check-email' : '/marketplace'}`, { timeout: 30000 });
    assert.ok(Date.now() - paintedAt >= 4000, 'navigation waits for a painted welcome');
    assert.deepEqual(errors, []);
    console.log(`PASS real Next signup/retry, full-screen welcome, ${motion}, falling/completion and actual navigation at ${width}px`);
    await context.close();
  }
  assert.equal(signups, 8);
} catch (error) { console.error(serverOutput); throw error; }
finally {
  await browser.close();
  next.kill('SIGINT');
  await new Promise(resolve => { if (next.exitCode !== null) resolve(); else next.once('exit', resolve); });
  await new Promise(resolve => stub.close(resolve));
  rmSync(root, { recursive: true, force: true });
}
