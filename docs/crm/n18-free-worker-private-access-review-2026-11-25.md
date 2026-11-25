# N18 — Free Worker private CRM access: read-only decision review

**Date:** 25 November 2026. **Active human:** Anais Daniel.
**Status:** DESIGN REVIEW ONLY — NO CLOUDFARE DEPLOYMENT OR ROUTE INTEGRATION.
**Existing authority:** A-222/A-224 permit bounded synthetic-only N18 tests; A-225 selects a conditional **Netlify** secret destination, and A-226 conditionally approves a separate private **Netlify** sandbox. Neither authorises a Cloudflare account, Cloudflare deployment, new secret destination, Alea account provisioning, or bypass of C13/N19.

## Verified starting state

- Branch `anais/n18-crm-sandbox` at `807fb84f8676a231b90118a61ae79f2ae0d14847` passed the vinext 1.4.0 compatibility scan (97%; one `reactStrictMode` partial) and a disposable actual Worker build with **dummy public Supabase settings**, no Cloudflare credentials and no deployment. See GitHub Actions runs 45520146474 and 45520146436.
- All marketplace and lister routes remain bundled into the Worker output. `lib/crm/private-site/routes.ts` is an inert pure allowlist; `proxy.ts` currently only delegates to `updateSession`. Therefore **nothing is privately isolated at runtime**.
- New source-only regression test `tests/crm-private-site-route-inventory.test.mjs` checks the *actual* app route inventory against the inert allowlist. It includes previously overlooked non-API lister download routes. Its passing status, if any, is evidence only about source decisions, not deployed security.
- The existing `proxy.ts` matcher deliberately skips Next static assets, the image loader, favicon and image extensions. Merely importing the helper into the existing proxy function would not cover every path; any site-only enforcement plan must review the matcher and edge protection explicitly.
- The present `/auth/login` page defaults its `next` to `/account`; `app/auth/actions.ts` also defaults sign-in and email-confirmation redirects to `/account`, and `logout` redirects to `/`. Both `/account` and `/` are correctly denied by the CRM-only allowlist. Login, reset/recovery and sign-out therefore need a specifically reviewed **isolated-site** success/error destination contract; do not broadly allow `/account` to work around this.
- `lib/crm/auth.ts` requires Supabase AAL2/current+next MFA for **all** CRM roles, plus an active bound staff record and checked sandbox DB principal. No dedicated CRM MFA enrol/challenge page appears in the current route inventory. Actual two-person MFA, session revocation, separate staff identity, recovery and non-bypassable per-human write audit have not been verified.
- The general Neon SQL management connector can select owner/write roles and is NOT an individually attributable real-contact writer.

## Current public provider facts (not an approval to register)

- Cloudflare Workers Free is publicly offered without a credit card; Workers Free has quotas. Workers/vinext supports `proxy.ts` at the documented API level, but the build did not validate HolyHub runtime behaviour.
- Cloudflare Zero Trust Free **onboarding documentation requires payment details even on Free**; Cloudflare says Free plan users are not charged for that onboarding. Therefore two-person **Access-protected** hosting has not been proven to meet Anais's current `£0 / no founder billing details` restriction.
- Cloudflare documents Worker-scoped encrypted secrets. Their existence does **not** demonstrate the HolyHub `CRM_DATABASE_URL` code path is wired correctly on vinext, that secrets stay out of client assets, or that Free quotas will suffice.

Official documentation checked:
- https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://www.cloudflare.com/products/workers/
- https://developers.cloudflare.com/cloudflare-one/setup/
- https://developers.cloudflare.com/workers/configuration/secrets/

## Exact proposed site-only integration review for Alea — NOT implemented

1. **Scope and site identity:** A *new* isolated synthetic-only CRM origin/Worker and dedicated configuration, never the existing Netlify site or marketplace production branch. New platform/account/provider choice needs separate founder authorisation. No signup, billing, DNS, custom domain or deploy in this phase.
2. **Fail-closed routing:** On only that new deployment, ensure the allowlist runs for **all relevant requests** (including bypass classes in the current matcher) before any non-CRM handler can run. Reject public products, Stripe webhook, marketplace, lister pages/download routes, other APIs and unknown paths. No wildcard `/api/*` or `/auth/*`. Edge/private visitor access is separate from app authorization.
3. **Auth and origin:** CRM-specific return destination must be `/admin/crm`, with exact allowlisted login, callback, confirmation, password reset, logout behaviour, MFA enrol/challenge, step-up, access-denied and recovery flows. Validate `NEXT_PUBLIC_SITE_URL`, Supabase redirect allowlist, cookies, CSRF, independent staff binding, AAL2 and revocation. Changes to Alea-owned auth require her explicit separate review.
4. **Data security:** Only sandbox `hh_crm_api_runtime` with checked DB environment, Worker-scoped server secrets (not `NEXT_PUBLIC_`), no owner SQL, no real people. Verify `process.env`/Worker-binding integration without exposing values. A-225 is Netlify-specific: Anais must separately approve any Cloudflare secret destination before credential wiring.
5. **Evidence:** Run isolated synthetic-only runtime/route tests against all existing and negative paths, both human identities and wrong-role cases, source-map/static/redirect leakage, MFA, audit rollback, and recovery. Record actual results, not build-only assurances.
6. **Hold points:** C13 founder-level staff privacy/MFA/recovery/security sign-off, N19 witnessed overlapping two-human stale-write/handover tests, non-bypassable real-write attribution, separate lawful real-data approval and GATE-007 cutover remain unsatisfied. All 32 official invite drafts remain HOLD; HubSpot remains canonical.

## Decision for a later founder review

**Question:** Should HolyHub pursue a new, separate **Cloudflare Worker + Access** private CRM test once its complete access, billing-onboarding and security plan is acceptable?

**Current recommendation:** **Do not provision or deploy.** Preserve free/no-card preference; continue bounded source-only synthetic regression checks while Access Free's required payment details cannot be supplied. Do not silently replace Access with a public Worker or loosen route/secret requirements. If founder reviews a **different** no-card private-access approach, present its exact controls, cost and trade-offs as a fresh design decision rather than treating A-225/A-226 as approval.

**Unchanged:** Existing HolyHub website/Netlify and publish lock; Alea's protected C13 work; Supabase accounts and redirect settings; Neon SQL/grants/database; all credentials, payment details, live contacts, marketing sends, HubSpot, Tally, GATE-007.
