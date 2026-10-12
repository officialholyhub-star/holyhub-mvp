// Offline layout checks: real page markup and CSS, mocked data, no running app.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { page as renderPage, query } from './helpers/render-progress.mjs';
const require = createRequire('/tmp/hh-progress-browser-qa/package.json');
const { chromium } = require('playwright-core');
const products = ['draft', 'pending', 'rejected', 'approved', 'approved'].map((review_status, i) => ({ id: `product-${i}`, name: 'A handmade product with a longer name', lister_user_id: 'owner', review_status, is_published: i === 4, review_reason: 'Please add a clear cover photo and check the product description.' }));
const supabase = { from(table) { return query({ error: null, count: 2, data: table === 'products' ? products : table === 'lister_storefronts' ? [{ user_id: 'owner', business_name: 'A shop with a longer business name', category_type: 'Books' }] : table === 'lister_applications' ? [{ id: 'application', user_id: 'owner', business_name: 'A shop', category_type: 'Books', status: 'approved' }] : table === 'user_roles' ? [{ user_id: 'owner' }] : [] }); } };
const lister = { from(table) { return table === 'lister_storefronts' ? query({ data: { business_name: 'A shop with a longer business name' }, error: null }) : supabase.from(table); } };
const dependencies = { '@/lib/fulfilment-summary': { getSellerFulfilmentSummary: async () => ({ toFulfil: 2 }) } };
const screens = [
  await renderPage('app/lister/page.tsx', lister, {}, dependencies),
  await renderPage('app/admin/page.tsx', supabase),
  await renderPage('app/admin/listers/page.tsx', supabase),
];
const css = ['app/globals.css', 'app/visual-polish.css', 'components/lister-onboarding.module.css'].map(file => readFileSync(file, 'utf8')).join('\n');
const browser = await chromium.launch({ executablePath: '/home/codespace/.cache/ms-playwright/chromium-1193/chrome-linux/chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.route('**/*', route => route.abort());
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [index, html] of screens.entries()) {
      await page.setContent(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="page-shell">${html}</main></body></html>`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Screen ${index} overflows at ${width}`);
      for (const action of await page.locator('.listing-progress a, .admin-overview-card').all()) {
        const box = await action.boundingBox();
        assert.ok(box && box.width > 0 && box.height > 0, `Action hidden at ${width}`);
        assert.ok(box.x >= 0 && box.x + box.width <= width + 1, `Action outside viewport at ${width}`);
      }
    }
  }
  console.log('PASS: 3 dashboard/directory layouts at 320, 390, 768 and 1280px; no external requests.');
} finally { await browser.close(); }
