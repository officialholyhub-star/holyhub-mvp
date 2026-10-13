import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

test("development, diagnostic and replay commands refuse live keys before any API access", () => {
  for (const script of ["scripts/dev-stripe.mjs", "scripts/stripe-test-diagnostics.mjs", "scripts/stripe-test-replay.mjs"]) {
    const result = spawnSync(process.execPath, [script, "evt_test"], {
      env: { ...process.env, STRIPE_SECRET_KEY: "sk_live_DO_NOT_USE", STRIPE_WEBHOOK_SECRET: "whsec_DO_NOT_PRINT" },
      encoding: "utf8", timeout: 5000,
    });
    assert.equal(result.status, 1, script);
    const output = result.stdout + result.stderr;
    assert.ok(output.includes("TEST"), script);
    assert.ok(!output.includes("sk_live_DO_NOT_USE"), script);
    assert.ok(!output.includes("whsec_DO_NOT_PRINT"), script);
  }
});
