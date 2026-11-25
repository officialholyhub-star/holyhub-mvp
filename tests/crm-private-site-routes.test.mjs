import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadTypescript } from "./helpers/load-typescript.mjs";

const { isPermittedPrivateCrmPath: permits } =
  loadTypescript("lib/crm/private-site/routes.ts");

test("proposed private-site gate allows only named CRM pages and bounded APIs", () => {
  for (const path of [
    "/admin/crm",
    "/admin/crm/",
    "/api/crm/operate",
    "/api/crm/dashboard",
    "/api/crm/actions",
  ]) assert.equal(permits(path),true,path);
});

test("necessary authentication and static assets remain accessible", () => {
  for (const path of [
    "/auth/login",
    "/auth/callback",
    "/auth/confirm",
    "/auth/blocked",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/check-email",
    "/_next/static/chunks/a.js",
    "/_next/static/css/a.css",
    "/_next/image",
    "/holyhub-logo.png",
    "/favicon.ico",
  ]) assert.equal(permits(path),true,path);
});

test("other HolyHub page and API routes are denied, even when present in the same build", () => {
  for (const path of [
    "/", "/marketplace", "/products/123", "/basket", "/checkout/success",
    "/lister", "/lister/orders/export", "/lister/products/new",
    "/account", "/account/favourites", "/account/orders",
    "/auth/signup", "/admin/products", "/admin/applications",
    "/api/stripe/webhook", "/api/favourites",
    "/api/church-locator/autocomplete", "/api/church-locator/details",
    "/events", "/hub", "/churches/profile", "/privacy", "/terms",
    "/images/community-lifestyle.jpg",
  ]) assert.equal(permits(path),false,path);
});

test("unrecognised CRM subroutes do not inherit access by prefix", () => {
  for (const path of [
    "/api/crm/unknown", "/admin/crm/export", "/admin/crm/secret",
    "/admin/crm-admin", "/api/crm-other", "/auth/other",
  ]) assert.equal(permits(path),false,path);
});

test("ambiguous URLs and traversal never expand the allowlist", () => {
  for (const path of [
    "", null, undefined, {}, "//admin/crm", "/admin//crm",
    "/admin/crm/../products", "/api/crm/operate/../../stripe/webhook",
    "/api/%63rm/operate", "/admin/crm%2f..%2fproducts",
    "/admin\\crm", "/admin/crm?secret=1", "/admin/crm#part",
  ]) assert.equal(permits(path),false,String(path));
});

test("route guard remains inert until separate-site proxy integration is authorised", () => {
  const standalone=fs.readFileSync("lib/crm/private-site/routes.ts","utf8");
  const proxy=fs.readFileSync("proxy.ts","utf8");
  assert.match(standalone,/Deliberately not wired into proxy\.ts/);
  assert.doesNotMatch(proxy,/isPermittedPrivateCrmPath|CRM_PRIVATE_SANDBOX/);
  assert.match(proxy,/return updateSession\(request\)/);
});
