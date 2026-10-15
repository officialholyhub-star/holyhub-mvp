// Runs real React components against mocked auth/navigation; never writes live users.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { renderAccount } from './helpers/render-account.mjs';
const directory = process.env.HOLYHUB_BROWSER_TOOLS_DIR || '/tmp/holyhub-onboarding-tools';
const require = createRequire(path.join(directory, 'package.json'));
const { build } = require('esbuild');
const { chromium } = require('playwright');
const output = path.join(directory, 'results');
mkdirSync(output, { recursive: true });
const css = ['app/globals.css', 'app/visual-polish.css', 'components/customer-onboarding.module.css', 'components/password-input.module.css'].map(file => readFileSync(file, 'utf8')).join('\n');
const result = await build({
  stdin: { contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import { CustomerOnboarding } from './components/customer-onboarding'; import { CustomerSetupReminder } from './components/customer-setup-reminder'; window.render = (userId, reminder = false, editPreferences = false) => { window.reactRoot ||= createRoot(document.getElementById('root')); window.reactRoot.render(reminder ? <CustomerSetupReminder userId={userId} /> : <CustomerOnboarding userId={userId} editPreferences={editPreferences} />); }; window.render();`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, jsx: 'automatic', nodePaths: [path.join(process.cwd(), 'node_modules')],
  plugins: [{ name: 'fixture', setup(api) {
    api.onResolve({ filter: /^next\/|^@\/app\/auth\/actions$/ }, args => ({ path: args.path, namespace: 'mock' }));
    api.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ resolveDir: process.cwd(), loader: 'jsx', contents: args.path === 'next/link' ? `import React from 'react'; export default function Link(props) { return <a {...props} />; }` : args.path === 'next/navigation' ? `export const usePathname = () => '/account'; const router = { push(url) { window.destination = url; }, replace(url) { window.destination = url; }, refresh() {} }; export const useRouter = () => router;` : `export async function signup(data) { window.submitted = Object.fromEntries(data); return window.signupResult || { next: '/account', userId: 'new-user' }; }` }));
    api.onResolve({ filter: /^@\// }, args => ({ path: path.resolve(`${args.path.slice(2)}.tsx`).replace(/\.tsx$/, args.path.startsWith('@/lib/') ? '.ts' : '.tsx') }));
    api.onLoad({ filter: /\.module\.css$/ }, args => ({ contents: `export default ${JSON.stringify(Object.fromEntries([...readFileSync(args.path, 'utf8').matchAll(/\.([a-zA-Z][\w-]*)/g)].map(match => [match[1], match[1]])))}`, loader: 'js' }));
  } }],
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.on("pageerror", error => console.error(error.message));
  async function reset(width = 390, motion = 'no-preference') {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: motion });
    await page.goto('http://holyhub.test');
    await page.addScriptTag({ content: result.outputFiles[0].text });
    await page.getByRole('heading', { name: 'What brings you' }).waitFor();
  }
  await page.route('http://holyhub.test/**', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div></body></html>` }));
  for (const width of [320, 390, 768, 1440]) {
    await reset(width);
    assert.equal(await page.getByRole('button', { name: 'Continue', exact: true }).isDisabled(), true);
    await page.screenshot({ path: `${output}/disabled-continue-${width}.png`, fullPage: true });
    await page.getByRole('checkbox', { name: 'Discover Christian brands', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Find community', exact: true }).check();
    assert.equal(await page.locator('input:checked').count(), 2);
    assert.equal(await page.getByRole('button', { name: 'Continue', exact: true }).isEnabled(), true);
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${output}/interests-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('radio', { name: 'Prefer not to say', exact: true }).check();
    await page.getByRole('radio', { name: 'I’m exploring Christianity', exact: true }).check();
    assert.equal(await page.locator('input:checked').count(), 1);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    assert.equal(await page.getByRole('checkbox', { name: 'Find community', exact: true }).isChecked(), true);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('radio', { name: 'Prefer not to say', exact: true }).check();
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${output}/faith-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    assert.equal(await page.getByLabel('I’d like HolyHub').isChecked(), false);
    await page.getByLabel('First name', { exact: true }).fill('Alex');
    await page.getByLabel('Email', { exact: true }).fill('alex@example.test');
    await page.getByLabel('Password', { exact: true }).fill('abcdefghijk');
    assert.equal(await page.locator('#password').evaluate(input => input.validity.tooShort), true);
    await page.getByLabel('Password', { exact: true }).fill('abcdefghijkl');
    await page.getByLabel('Confirm password', { exact: true }).fill('abcdefghijkl');
    await page.getByLabel('I agree to').check();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    assert.equal(await page.getByLabel('First name', { exact: true }).inputValue(), 'Alex');
    assert.equal(await page.locator('form').evaluate(form => form.checkValidity()), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${output}/join-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Create my account' }).click();
    await page.getByRole('heading', { name: 'Welcome to HolyHub' }).waitFor();
    assert.equal(await page.getByText('Connect. Discover. Grow.', { exact: true }).isVisible(), true);
    await page.locator('[data-celebration=falling]').waitFor();
    assert.equal(await page.locator('[data-celebration=falling] .confetti i').count(), 84);
    assert.equal(await page.locator('.confetti').evaluate(node => getComputedStyle(node).pointerEvents), 'none');
    await page.screenshot({ path: `${output}/welcome-${width}.png` });
    await page.waitForTimeout(850);
    await page.screenshot({ path: `${output}/confetti-${width}.png` });
    await page.locator('[data-celebration=complete]').waitFor();
    assert.equal(await page.locator('.confetti').count(), 0);
    assert.equal(await page.evaluate(() => window.destination), undefined);
    assert.equal(await page.evaluate(() => Object.keys(window.submitted).some(key => /faith|interest|marketing/.test(key))), false);
    await page.waitForFunction(() => window.destination === '/marketplace');
    assert.deepEqual(await page.evaluate(() => JSON.parse(sessionStorage.getItem('hh-customer-setup-v1:new-user'))), { interests: true, faith: true });
    console.log(`PASS completed flow, back, selection, consent, validation, welcome and layout at ${width}px`);
  }
  // Each optional step can be skipped independently, with first-incomplete resume.
  for (const skipped of [1, 2, 'both']) {
    await reset();
    if (skipped === 2) await page.getByRole('checkbox', { name: 'Just explore', exact: true }).check();
    await page.getByRole('button', { name: skipped === 2 ? 'Continue' : 'Skip for now', exact: true }).click();
    if (skipped === 1) await page.getByRole('radio', { name: 'Prefer not to say', exact: true }).check();
    await page.getByRole('button', { name: skipped === 1 ? 'Continue' : 'Skip for now', exact: true }).click();
    await page.getByLabel('First name', { exact: true }).fill('Alex');
    await page.getByLabel('Email', { exact: true }).fill('alex@example.test');
    await page.getByLabel('Password', { exact: true }).fill('abcdefghijkl');
    await page.getByLabel('Confirm password', { exact: true }).fill('abcdefghijkl');
    await page.getByLabel('I agree to').check();
    await page.getByRole('button', { name: 'Create my account' }).click();
    await page.waitForFunction(() => window.destination === '/marketplace');
    await page.evaluate(() => { window.reactRoot.unmount(); window.reactRoot = null; window.render('new-user', true); });
    await page.getByRole('complementary', { name: 'Optional HolyHub setup' }).waitFor();
    await page.getByRole('button', { name: 'Dismiss setup reminder' }).click();
    await page.evaluate(() => { window.reactRoot.unmount(); window.reactRoot = null; window.render('new-user', true); });
    await page.waitForTimeout(100);
    assert.equal(await page.getByRole('complementary').count(), 0);
    await page.evaluate(() => { window.reactRoot.unmount(); window.reactRoot = null; window.render('new-user'); });
    await page.getByRole('heading', { name: skipped === 2 ? 'What does your faith' : 'What brings you' }).waitFor();
    console.log(`PASS skip ${skipped}, signup without marketing, banner, session dismissal and correct resume`);
  }
  await reset();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByLabel('First name', { exact: true }).fill('Alex');
  await page.getByLabel('Email', { exact: true }).fill('alex@example.test');
  await page.getByLabel('Password', { exact: true }).fill('abcdefghijkl');
  await page.getByLabel('Confirm password', { exact: true }).fill('abcdefghijkl');
  await page.getByLabel('I agree to').check();
  await page.getByLabel('I’d like HolyHub').check();
  await page.evaluate(() => { window.signupResult = { error: 'Please try again.' }; });
  await page.getByRole('button', { name: 'Create my account' }).click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByLabel('First name', { exact: true }).inputValue(), 'Alex');
  assert.equal(await page.getByLabel('Password', { exact: true }).inputValue(), 'abcdefghijkl');
  assert.equal(await page.getByLabel('I agree to').isChecked(), true);
  await page.evaluate(() => { window.signupResult = { next: '/auth/check-email' }; });
  await page.getByRole('button', { name: 'Create my account' }).click();
  await page.waitForFunction(() => window.destination === '/auth/check-email');
  assert.equal(await page.evaluate(() => JSON.stringify(window.submitted).includes('marketing')), false);
  console.log('PASS marketing checked without transmission, retry retention and confirmation destination');
  await reset();
  await page.evaluate(() => { window.reactRoot.unmount(); window.reactRoot = null; window.render('existing-user', true); });
  const continueSetup = page.getByRole('link', { name: 'Continue setup' });
  await continueSetup.waitFor();
  assert.equal(await continueSetup.getAttribute('href'), '/account/setup');
  await continueSetup.evaluate(link => link.addEventListener("click", event => event.preventDefault(), { once: true }));
  await continueSetup.click();
  assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('hh-customer-setup-v1:existing-user')).dismissed), true);
  await page.evaluate(() => { window.reactRoot.unmount(); window.reactRoot = null; window.render('existing-user'); });
  await page.getByRole('checkbox', { name: 'Just explore', exact: true }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('radio', { name: 'Prefer not to say', exact: true }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForFunction(() => window.destination === '/account');
  assert.equal(await page.locator('form').count(), 0);
  console.log('PASS existing user reminder link and optional setup without duplicate signup');
  await reset(390, 'reduce');
  assert.equal(await page.locator('.step').evaluate(node => getComputedStyle(node).animationName), 'none');
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  assert.equal(await page.getByRole('heading', { name: 'Join HolyHub' }).isVisible(), true);

  await page.getByLabel('First name', { exact: true }).fill('Alex');
  await page.getByLabel('Email', { exact: true }).fill('alex@example.test');
  await page.getByLabel('Password', { exact: true }).fill('abcdefghijkl');
  await page.getByLabel('Confirm password', { exact: true }).fill('abcdefghijkl');
  await page.getByLabel('I agree to').check();
  await page.getByRole('button', { name: 'Create my account' }).click();
  await page.locator('[data-celebration=reduced]').waitFor();
  assert.equal(await page.locator('.confetti').count(), 0);
  assert.equal(await page.getByRole('heading', { name: 'Welcome to HolyHub 💙', exact: true }).isVisible(), true);
  await page.waitForFunction(() => window.destination === '/marketplace');
  for (const width of [390, 1440]) {
    await reset(width);
    const { html } = await renderAccount();
    const accountCss = ['app/globals.css', 'app/visual-polish.css', 'app/account/page.module.css'].map(file => readFileSync(file, 'utf8')).join('\n');
    await page.setContent(`<style>${accountCss}</style><main>${html}</main>`);
    const entry = page.getByRole('link', { name: 'Edit preferences', exact: true });
    assert.equal(await entry.getAttribute('href'), '/account/setup?edit=1');
    await page.getByRole('heading', { name: 'Personalise HolyHub' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/account-preferences-${width}.png`, fullPage: true });
    await entry.evaluate(link => link.addEventListener('click', event => event.preventDefault(), { once: true }));
    await entry.click();
    await reset(width);
    await page.evaluate(() => {
      sessionStorage.setItem('hh-customer-setup-v1:existing-user', JSON.stringify({ interests: true, faith: true, dismissed: true }));
      window.reactRoot.unmount(); window.reactRoot = null; window.render('existing-user', false, true);
    });
    await page.getByRole('heading', { name: 'What brings you' }).waitFor();
    assert.equal(await page.locator('input:checked').count(), 0);
  }
  console.log('PASS permanent account entry, completed/dismissed setup editing, reduced-motion welcome and destination');

} finally { await browser.close(); }
