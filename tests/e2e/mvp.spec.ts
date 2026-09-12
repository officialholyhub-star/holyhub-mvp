import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Test-only-password8!");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
}
test.beforeEach(async ({ request }) => { await request.post("http://127.0.0.1:54329/__test/reset"); });

test("home, account links and discovery work at mobile and desktop sizes", async ({ page }) => {
  for (const width of [320, 375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Where Christian brands");
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Log in", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.screenshot({ path: "test-results/holyhub-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/holyhub-mobile.png", fullPage: true });
  await page.getByRole("link", { name: "Explore businesses", exact: false }).first().click();
  await expect(page).toHaveURL(/\/businesses/);
  await expect(page.getByRole("heading", { name: "Be part of the beginning." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Contact", exact: true })).toHaveAttribute("href", "mailto:Official.holyhub@gmail.com");
});

test("signup, guarded routes, confirmation and reset flows", async ({ page }) => {
  await page.goto("/account/business");
  await expect(page).toHaveURL(/auth\/login.*next=/);
  await page.getByRole("link", { name: "Create account", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("New owner");
  await page.getByLabel("Email", { exact: true }).fill("new@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Test-only-password8!");
  await page.getByLabel("Confirm password", { exact: true }).fill("Test-only-password8!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByText("Check your email to confirm your account", { exact: false })).toBeVisible();
  await page.goto("/auth/confirm?type=email&token_hash=bad&next=//evil.example");
  await expect(page).toHaveURL(/127.0.0.1:3101\/auth\/login\?error=/);
  await page.goto("/auth/confirm?type=recovery&token_hash=valid-test-link");
  await expect(page).toHaveURL(/\/auth\/reset-password$/);
  await page.getByLabel("New password", { exact: true }).fill("Another-password123!");
  await page.getByLabel("Confirm new password", { exact: true }).fill("Another-password123!");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText("Password updated.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await page.goto("/auth/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill("unknown@example.test");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If that email belongs to a HolyHub account", { exact: false })).toBeVisible();
});

test("owner submits, admin approves, visitor discovers, owner edit returns to review", async ({ page, browser }) => {
  await login(page, "owner@example.test");
  await page.getByLabel("Name", { exact: true }).fill("Alea");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile updated.", { exact: true })).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/account\?error=/);
  await page.getByRole("link", { name: "Your business listing", exact: false }).click();
  await page.getByLabel("Business or brand name").fill("Grace Studio");
  await page.getByLabel("Category", { exact: true }).selectOption("Art & Creators");
  await page.getByLabel("Location", { exact: true }).fill("London");
  await page.getByLabel("Short introduction").fill("Thoughtful art with faith at its heart.");
  await page.getByLabel("Your story & what you offer").fill("A Christian-owned studio creating thoughtful prints and art for your home.");
  await page.getByLabel("Website or social profile").fill("https://example.com/grace");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("In review", { exact: true })).toBeVisible();
  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  await visitor.goto("http://127.0.0.1:3101/businesses");
  await expect(visitor.getByRole("heading", { name: "Grace Studio" })).toHaveCount(0);
  const adminContext = await browser.newContext({ baseURL: "http://127.0.0.1:3101" });
  const admin = await adminContext.newPage();
  await login(admin, "admin@example.test");
  await admin.getByRole("link", { name: "Review listings" }).click();
  await admin.getByRole("button", { name: "Approve & publish" }).click();
  await expect(admin.getByText("Listing approved.", { exact: true })).toBeVisible();
  await visitor.reload();
  await expect(visitor.getByRole("heading", { name: "Grace Studio" })).toBeVisible();
  await visitor.getByLabel("What are you looking for?").fill("Grace");
  await visitor.getByLabel("Category", { exact: true }).selectOption("Art & Creators");
  await visitor.getByRole("button", { name: "Search", exact: false }).click();
  await expect(visitor.getByRole("heading", { name: "Grace Studio" })).toBeVisible();
  await visitor.getByRole("heading", { name: "Grace Studio" }).getByRole("link").click();
  await expect(visitor.getByRole("link", { name: "Visit website or social profile", exact: false })).toHaveAttribute("href", "https://example.com/grace");
  await page.reload();
  await page.getByLabel("Short introduction").fill("Updated introduction with faith at its heart.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save & submit for review" }).click();
  await expect(page.getByText("In review", { exact: true })).toBeVisible();
  await visitor.reload();
  await expect(visitor.getByRole("heading", { name: "This page isn’t here." })).toBeVisible();
  await adminContext.close(); await visitorContext.close();
});
