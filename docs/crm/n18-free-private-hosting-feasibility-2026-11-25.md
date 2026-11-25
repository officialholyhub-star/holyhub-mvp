# N18 / C13 — Free private hosting feasibility checkpoint (25 Nov 2026)

**Active human:** Anais. **State:** Research + code-only synthetic compatibility check, NOT an approved deployment/provider cutover.

## Candidate: Cloudflare Workers Free + Cloudflare Access Free

Official Cloudflare guidance currently supports:
- Running existing Next.js 16 apps via vinext (a separate adaptation, not automatic compatibility).
- Protecting a whole Worker, production and preview, including its workers.dev address, with Cloudflare Access policies for permitted individual users, even without a custom domain.
- Per-Worker encrypted secrets for CRM_DATABASE_URL and other *server-only* values, without exposing them through Next's NEXT_PUBLIC_ environment.
- A Free Workers/Zero Trust tier, with capacity and resource limits. Zero Trust Free onboarding says **payment details are required even though the free plan is not charged**. This is an onboarding/payment-method decision for Alea; no registration, card input or opt-in made.
- Workers Free has request/CPU and other quota limits; both feasibility and risk must be tested before using real CRM contacts. Confirm any plan/limits on provider dashboard. Cloudflare's September 2026 worker upload limit changed; rely on the current live docs rather than old 3 MiB assertions.

Sources:
- https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/cloudflare-one/setup/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/changelog/post/2026-09-04-increased-worker-size-limit/

## Alternatives rejected or held

- **Netlify credit-based Free/Personal:** private site is single owner; private access for both Alea and Anais requires a paid tier, as does Functions-only environment-variable scope. Existing A-225/A-226 require no weaker secret-scope substitute. Keep existing Netlify project untouched.
- **Vercel Hobby:** official pricing states it is for personal non-commercial use, so do not use it as HolyHub's business CRM hosting.
- **General Neon ChatGPT MCP connection:** broad project/role/SQL management privilege is not independently attributable to per-person Supabase CRM sessions; not permitted for real-data writes.
- **Cloudflare Workers + Access:** best *candidate* for a two-person private CRM under Free, but not yet approved or proven functional for current Next.js/Neon/Supabase code. Need compatibility, budget/payment-method decision, exact founder provider approval, full route isolation, MFA enrol/recovery, audit/gateway tests, protected deployment, N19, C13 and real-data phases.

## Code-only compatibility scan

Added `.github/workflows/n18-cloudflare-feasibility.yml` on isolated `anais/n18-crm-sandbox`. The job installs existing npm packages on a disposable GitHub runner and runs `npx --yes vinext@1.4.0 check`. It does NOT import any Cloudflare authentication/secret, call Cloudflare APIs, deploy, alter code/config in the repository, or change Alea's public app. This is a compatibility SCANNER only. The output can show blockers; it is not a full build, functional auth test, or security clearance.

## Required decision and next safe action

**Alea / founder decision for a new provider, not yet recorded:** Approve or decline **Cloudflare Workers Free + Cloudflare Access Free as a separate CRM-only sandbox hosting exploration**, including awareness that Cloudflare Zero Trust onboarding may require payment details, but **no paid plan or actual spend**. Require a separate deployment/secret/identity permission after compatibility results, a secure route guard wired in ONLY on the isolated site, non-CRM route denial, testing and explicit approval. Do not change Netlify, production Supabase/auth redirects or any live CRM data in this research.

**N18 continue:** read the compatibility check output; if it fails, identify exact blocker without broad Next rewrite. If compatible, prepare an exact isolated test-only activation and rollback plan, including safe Cloudflare Access allowlist and secret/runtime role; don't deploy or provision credentials under this document.
