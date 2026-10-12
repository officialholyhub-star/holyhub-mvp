// Run the app and Stripe's TEST listener together with one matching secret.
// Secrets stay in child-process environment variables, never command arguments.
import nextEnv from "@next/env";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

nextEnv.loadEnvConfig(process.cwd(), true);
const key = process.env.STRIPE_SECRET_KEY;
if (!key?.startsWith("sk_test_")) {
  console.error("dev:stripe requires STRIPE_SECRET_KEY to be a Stripe TEST key.");
  process.exit(1);
}
const cliEnv = { ...process.env, STRIPE_API_KEY: key };
const result = spawnSync("stripe", ["listen", "--print-secret", "--skip-update"], {
  env: cliEnv, encoding: "utf8", timeout: 30000,
});
const secret = result.stdout?.trim();
if (result.status !== 0 || !/^whsec_[A-Za-z0-9]+$/.test(secret ?? "")) {
  console.error("Could not initialize the Stripe TEST listener. Check that Stripe CLI is installed and has network access. No credentials were printed.");
  process.exit(1);
}
const env = { ...cliEnv, STRIPE_WEBHOOK_SECRET: secret };
const listenOnly = process.argv.includes("--listen-only");
if (listenOnly && process.env.STRIPE_WEBHOOK_SECRET !== secret) {
  const file = ".env.local";
  const previous = existsSync(file) ? readFileSync(file, "utf8") : "";
  const setting = `STRIPE_WEBHOOK_SECRET=${secret}`;
  const updated = /^[ \t]*STRIPE_WEBHOOK_SECRET[ \t]*=/m.test(previous)
    ? previous.replace(/^[ \t]*STRIPE_WEBHOOK_SECRET[ \t]*=.*$/gm, setting)
    : `${previous}${previous.endsWith("\n") || !previous ? "" : "\n"}${setting}\n`;
  writeFileSync(file, updated, { mode: 0o600 });
  console.log("Updated the local webhook signing secret to match Stripe CLI. Restart the running dev server if it does not reload .env.local automatically.");
}
const app = listenOnly ? null : spawn("npm", ["run", process.env.CODESPACE_NAME ? "dev:codespace" : "dev", "--", "--port", "3000"], { env, stdio: "inherit" });
const listener = spawn("stripe", ["listen", "--skip-update", "--events", "checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired", "--forward-to", "http://127.0.0.1:3000/api/stripe/webhook"], { env, stdio: ["ignore", "pipe", "pipe"] });
// CLI prints its signing secret on startup. Line buffering also catches secrets
// split across stream chunks. Event IDs and HTTP delivery results remain visible.
function output(stream) {
  let buffered = "";
  stream.setEncoding("utf8");
  stream.on("data", chunk => {
    buffered += chunk;
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop();
    for (const line of lines) console.log(line.replace(/(?:whsec_|sk_test_|sk_live_)[A-Za-z0-9_]+/g, "[redacted]"));
  });
  stream.on("end", () => {
    if (buffered) console.log(buffered.replace(/(?:whsec_|sk_test_|sk_live_)[A-Za-z0-9_]+/g, "[redacted]"));
  });
}
output(listener.stdout);
output(listener.stderr);
console.log(`HolyHub TEST webhook forwarding: http://127.0.0.1:3000/api/stripe/webhook. ${listenOnly ? "Using the CLI signing secret from .env.local." : "Signing secret supplied to the app automatically; .env.local is unchanged."} Keep this command running while testing.`);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  app?.kill("SIGTERM");
  listener.kill("SIGTERM");
  // A disconnected CLI can otherwise keep shutdown hanging indefinitely.
  setTimeout(() => { app?.kill("SIGKILL"); listener.kill("SIGKILL"); }, 3000).unref();
  process.exitCode = code;
}
for (const child of [app, listener].filter(Boolean)) {
  child.on("error", () => { console.error("A development process could not start."); stop(1); });
  child.on("exit", code => stop(code ?? 1));
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
