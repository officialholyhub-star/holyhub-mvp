import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: { baseURL: "http://127.0.0.1:3101", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: [
    { command: "node tests/fixtures/supabase.mjs", url: "http://127.0.0.1:54329/__test/health", reuseExistingServer: false },
    { command: "npm run dev -- --hostname 127.0.0.1 --port 3101", url: "http://127.0.0.1:3101", timeout: 120_000, reuseExistingServer: false,
      env: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key", NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3101", NEXT_TELEMETRY_DISABLED: "1" } },
  ],
});
