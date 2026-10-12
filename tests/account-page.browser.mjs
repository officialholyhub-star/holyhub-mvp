// Tests the actual account page with mocked account data; no live user writes.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { renderAccount } from "./helpers/render-account.mjs";

const directory = process.env.HOLYHUB_BROWSER_TOOLS_DIR ?? "/tmp/holyhub-ux-browser";
const { chromium } = createRequire(path.join(directory, "package.json"))("playwright");
const output = path.join(directory, "account-results");
mkdirSync(output, { recursive: true });
// The rendering fixture maps module names to their original keys; match that mapping in CSS.
const css = ["app/globals.css", "app/visual-polish.css", "app/account/page.module.css", "components/account-lister-brand.module.css"].map(file => readFileSync(file, "utf8").replace(/:global\(([^)]+)\)/g, "$1")).join("\n");
const states = {
  customer: {},
  lister: { roles: [{ role: "customer" }, { role: "lister" }], storefront: { business_name: "Alex Shop", logo_url: null } },
  pending: { application: { status: "pending" } },
  approved: { application: { status: "approved" } },
  "lister-no-storefront": { roles: [{ role: "lister" }] },
  "long-name-admin": { fullName: "Alexandria".repeat(10), roles: [{ role: "customer" }, { role: "lister" }, { role: "admin" }] },
};
const browser = await chromium.launch({ executablePath: process.env.HOLYHUB_CHROMIUM_PATH ?? "/home/codespace/.cache/ms-playwright/chromium-1193/chrome-linux/chrome", headless: true });
try {
  const page = await browser.newPage();
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1100 });
    for (const [state, options] of Object.entries(states)) {
      const { html } = await renderAccount(options);
      await page.setContent(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><main class="page-shell">${html}</main></body></html>`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${state} overflows at ${width}`);
      assert.equal(await page.getByText("Explore Marketplace").count(), 0);
      const actions = page.getByRole("navigation", { name: "Your account" });
      for (const [name, href] of [["My Orders", "/account/orders"], ["Favourites", "/account/favourites"], ["Password / Security", "/auth/forgot-password"]]) {
        assert.equal(await actions.getByRole("link", { name: new RegExp(name) }).getAttribute("href"), href);
      }
      const shell = await page.locator(".page-shell").boundingBox();
      const account = await page.locator(".customer-space").boundingBox();
      assert.ok(Math.abs(account.width - shell.width) < 1, `${state} account nested cap at ${width}`);
      if (width >= 1200) {
        const cards = await page.locator(".actions > a").all();
        const bounds = await Promise.all(cards.map(card => card.boundingBox()));
        assert.ok(bounds.every(box => Math.abs(box.width - bounds[0].width) < 1 && Math.abs(box.y - bounds[0].y) < 1), `${state} unbalanced action cards at ${width}`);
      }
      const settings = await page.locator(".settings").boundingBox();
      const nav = await actions.boundingBox();
      assert.ok(settings.y > nav.y + nav.height, `${state} settings priority at ${width}`);
      for (const form of await page.locator("form").all()) assert.ok((await form.boundingBox()).width <= 480, `${state} form too wide at ${width}`);
      const lister = page.locator(".listerShortcut");
      if (options.roles?.some(({ role }) => role === "lister")) {
        assert.equal(await lister.count(), 1);
        assert.equal(await lister.getAttribute("href"), "/lister");
        const shortcut = await lister.boundingBox();
        assert.ok(shortcut.y + shortcut.height < nav.y, `Lister shortcut priority at ${width}`);
        assert.equal(await lister.getByText("Open lister space", { exact: false }).isVisible(), true);
      } else assert.equal(await lister.count(), 0);
      await page.getByLabel("Name", { exact: true }).fill("Alex Updated");
      await page.getByLabel("Email address", { exact: true }).fill("updated@example.test");
      assert.equal(await page.locator("form").evaluateAll(forms => forms.every(form => form.checkValidity())), true);
      await page.keyboard.press("Control+Home");
      await page.locator("body").click({ position: { x: 1, y: 1 } });
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("href")), options.roles?.some(({ role }) => role === "lister") ? "/lister" : "/account/orders");
      if (["customer", "lister"].includes(state)) await page.screenshot({ path: path.join(output, `${state}-${width}.png`), fullPage: true });
    }
    console.log(`PASS ${width}px: six account states, no overflow, compact forms, hierarchy, links and keyboard access`);
  }
} finally { await browser.close(); }
