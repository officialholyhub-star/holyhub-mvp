import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { loadTypescript } from "./helpers/load-typescript.mjs";

const { isPermittedPrivateCrmPath: permits } =
  loadTypescript("lib/crm/private-site/routes.ts");

// This is a source-only N18 regression test. It does NOT enable private-site
// proxy protection, create an identity, or make the existing site private.
const expectedCrmRoutes = new Set([
  "/admin/crm",
  "/api/crm/actions",
  "/api/crm/dashboard",
  "/api/crm/operate",
  "/auth/login",
  "/auth/callback",
  "/auth/confirm",
  "/auth/blocked",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/check-email",
]);

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const entry = path.posix.join(dir, item.name);
    return item.isDirectory() ? filesUnder(entry) : [entry];
  });
}

function routeFromFile(file) {
  const relative = file.replace(/^app\//, "")
    .replace(/(^|\/)(?:page|route)\.(?:ts|tsx)$/, "")
    .replace(/\[[^\]]+\]/g, "fictional-id");
  return "/" + relative.replace(/^\/|\/$/g, "");
}

test("the actual app page/action/route inventory is denied by default", () => {
  const routes = filesUnder("app")
    .filter((file) => /\/(?:page|route)\.(?:ts|tsx)$/.test(file))
    .map(routeFromFile);

  assert.ok(routes.length >= 50, "The route inventory unexpectedly shrank");
  for (const allowed of expectedCrmRoutes) {
    assert.ok(routes.includes(allowed), `Previously approved CRM/auth route missing: ${allowed}`);
  }
  for (const route of routes) {
    assert.equal(
      permits(route),
      expectedCrmRoutes.has(route),
      `Source route must stay explicitly allowed or denied: ${route}`,
    );
  }
});

test("non-API seller exports and dynamic product routes remain denied", () => {
  for (const route of [
    "/lister/orders/export",
    "/lister/products/bulk/template",
    "/lister/products/fictional-id/edit",
    "/lister/storefront/fictional-id",
    "/products/fictional-id",
  ]) {
    assert.equal(permits(route), false, route);
  }
});
