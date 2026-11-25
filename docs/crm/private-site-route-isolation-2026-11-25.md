# N18 — Private CRM route-isolation candidate (synthetic-only, unactivated)

**Active human:** Anais. **Date:** 25 November 2026. **Scope:** Code-only private-site safety design under A-224 N18 sandbox and A-226's conditional separate-site planning. NOT deployed, NOT integrated into global proxy.ts, not an Alea public-site update.

## Read-only evidence

At branch HEAD `f78f9f9da92789726cef60e1c4b89fb2f81457be`, the current Next.js app has seven `app/api/**/route.ts` endpoints: CRM `actions`, `dashboard`, `operate`; and non-CRM `/api/stripe/webhook`, `/api/favourites`, `/api/church-locator/autocomplete` and `/api/church-locator/details`. It has 53 page/non-API-route entries, of which only `/admin/crm/page.tsx` is CRM-specific. `proxy.ts` currently only delegates to generic Supabase session update; it does not deny non-CRM paths.

Therefore deploying the full repository as a public CRM preview would expose unrelated marketplace, lister, checkout, locator and app routes. Private Netlify visitor protection alone is insufficient to disable unwanted side effects: access control, route isolation and disabling live integration settings must all be independently verified.

## Preparation completed in isolated branch

Added a pure route decision helper `isPermittedPrivateCrmPath(pathname)` in `lib/crm/private-site/routes.ts` and tests `tests/crm-private-site-routes.test.mjs`. It permits only the existing three CRM APIs, CRM page, required login/auth recovery/callback pages, Next.js static and image-loader paths, and known logo/favicon. It rejects every non-CRM route, unrecognised CRM prefix, ambiguous encodings, traversal and other URLs. It does **not** hook into the live request handler. Six tests cover positive, negative, traversal and deliberate absence of global integration. This is a tested **design candidate**, not live enforcement.

## Remaining actual activation gate

Before any future separate-site deployment, Alea must review and explicitly approve the exact integration in an isolated branch/site, including all static/auth/sign-out links, any MFA enrol/challenge page, staging test origin and callbacks. If a required route is missing, amend via exact review—not by broadly permitting `/auth/*` or `/api/*`. Keep the main HolyHub app and all existing Netlify deploy locks intact.

Netlify Free/Personal private projects are owner-only and Functions-only environment scopes require a plan supporting them. Confirm actual team plan/seat and secret scope; no plan purchase, broad-scope fallback or exposure of the full site is approved. Test in a private synthetic-only environment with distinct staff identities and MFA after the C13/N19 access gates. A Work browser may interact with a supported signed-in website but has not accessed this unactivated site.

No SQL, Neon DB, Supabase auth accounts, staff mappings, Netlify, production, real contacts, marketing messages, subscription or publication was changed.
