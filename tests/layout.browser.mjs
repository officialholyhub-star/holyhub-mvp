// Run with Playwright installed in HOLYHUB_BROWSER_TOOLS_DIR (defaults to /tmp/holyhub-ux-browser).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const directory = process.env.HOLYHUB_BROWSER_TOOLS_DIR ?? "/tmp/holyhub-ux-browser";
const { chromium } = createRequire(path.join(directory, "package.json"))("playwright");
const output = path.join(directory, "layout-results");
mkdirSync(output, { recursive: true });
const css = ["app/globals.css", "app/visual-polish.css"].map(file => readFileSync(file, "utf8")).join("\n");
const browser = await chromium.launch({ executablePath: process.env.HOLYHUB_CHROMIUM_PATH ?? "/home/codespace/.cache/ms-playwright/chromium-1193/chrome-linux/chrome", headless: true });
const widths = [320, 390, 768, 1024, 1440, 1920];
const cards = (count, className) => Array.from({ length: count }, (_, i) => `<article class="${className}"><h2>Example ${i + 1}</h2><p>Readable content and comfortable spacing.</p></article>`).join("");
try {
  const page = await browser.newPage();
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["/", "/marketplace", "/events", "/auth/login", "/auth/signup", "/auth/forgot-password"]) {
      await page.goto(`${process.env.HOLYHUB_BROWSER_URL ?? "http://127.0.0.1:3000"}${route}`, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(() => [...document.querySelectorAll("body *")].filter(element => element.getBoundingClientRect().right > innerWidth + 1).map(element => `${element.tagName}.${element.className}`).slice(0, 12));
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
        console.log(await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, elements: [...document.querySelectorAll("body *")].filter(element => element.scrollWidth > element.clientWidth && element.clientWidth > 0).map(element => ({ tag: element.tagName, cls: element.className, width: element.clientWidth, scroll: element.scrollWidth, overflow: getComputedStyle(element).overflowX })) })));
        await page.screenshot({ path: path.join(output, "overflow.png"), fullPage: true });
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route} overflows at ${width}: ${overflow.join(", ")}`);
      const shell = await page.locator(".page-shell").boundingBox();
      assert.ok(Math.abs(shell.width - (width >= 1200 ? Math.min(1536, width * .8) : width - 36)) < 2, `${route} shell width at ${width}`);
      if (route.startsWith("/auth/")) {
        assert.ok((await page.locator(".auth-wrap").boundingBox()).width <= 480, `Auth form at ${width}`);
      }
      if (route === "/marketplace") {
        const hero = await page.locator(".marketplace-hero").boundingBox();
        const filter = await page.locator(".marketplace-filter").boundingBox();
        assert.ok(Math.abs(hero.width - shell.width) < 1, `Marketplace hero nested cap at ${width}`);
        assert.ok(Math.abs(filter.width - (shell.width - (width <= 720 ? 20 : 32))) < 2, `Marketplace filters nested cap at ${width}`);
        console.log(`Marketplace ${width}px: shell/hero ${shell.width}px, filters ${filter.width}px (${Math.round(shell.width / width * 100)}% viewport)`);
        const columns = await page.locator(".marketplace-grid").first().evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length);
        assert.equal(columns, width >= 1800 ? 5 : width > 1040 ? 4 : width > 720 ? 3 : 2);
      }
      await page.screenshot({ path: path.join(output, `${route.replaceAll("/", "_") || "home"}-${width}.png`), fullPage: true });
    }
    // Authenticated workspace geometry, without credentials or database writes.
    await page.setContent(`<style>${css}</style><main class="page-shell">
      <section class="lister-space"><h1>Lister space</h1><div class="lister-actions">${cards(5, "lister-action-card")}</div></section>
      <section class="lister-orders-page"><h1>Orders</h1><div class="lister-order-list">${cards(4, "lister-order-card")}</div></section>
      <section class="customer-space"><div class="account-grid customer-account-grid">${cards(7, "card customer-settings-card")}</div></section>
      <section class="admin-workspace"><div class="admin-overview-grid">${cards(3, "admin-overview-card")}</div></section>
      <section class="auth-wrap"><form class="form"><label class="field">Name<input /></label></form></section>
    </main>`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Workspace overflow at ${width}`);
    for (const selector of [".lister-space", ".lister-orders-page", ".customer-space", ".admin-workspace"]) {
      assert.ok(Math.abs((await page.locator(selector).boundingBox()).width - (await page.locator(".page-shell").boundingBox()).width) < 1, `${selector} nested cap at ${width}`);
    }
    for (const selector of [".lister-actions", ".lister-order-list"]) {
      assert.equal(await page.locator(selector).evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length), width >= 1024 ? 2 : 1);
    }
    assert.equal(await page.locator(".customer-account-grid").evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length), width >= 1200 ? 3 : width > 720 ? 2 : 1);
    assert.equal(await page.locator(".admin-overview-grid").evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length), width >= 1024 ? 3 : width > 720 ? 2 : 1);
    await page.screenshot({ path: path.join(output, `workspaces-${width}.png`), fullPage: true });
    console.log(`PASS ${width}px: public pages, form caps, marketplace columns, workspace geometry, no overflow`);
  }
} finally { await browser.close(); }
