# N18 — Cloudflare vinext actual build experiment (25 Nov 2026)

**Owner:** Anais. **Scope:** A-224 code-only synthetic testing. No provider account, Cloudflare domain, payment, deployment, secret, identity, permissions, database schema or live contact change.

The initial vinext 1.4.0 `check` completed successfully on branch commit 5db2353b670efe194d24615f164ed0f5dbb5d1d7. Log details: **97% compatible** (18 supported, 1 partial, 0 issues). The one partial is `reactStrictMode` (Pages Router only; current App Router not wrapped). This static scan does not demonstrate runtime behaviour, production readiness, live use or Cloudflare billing entitlement.

This follow-on GitHub Actions `isolated-build` job checks out the N18 branch, copies code into `$RUNNER_TEMP/n18-cloudflare-compat`, installs npm packages there, initialises vinext in that temporary copy, and runs `npm run build:vinext` with **dummy public Supabase settings** and `CRM_ENVIRONMENT=sandbox`. It has read-only GitHub permissions, no Cloudflare secrets and **no deploy/publish commands**. It has a 15-minute job limit. The checked-out repository (including HolyHub's public-site routing) stays unchanged. A fail is evidence of a compatibility blocker, not a request to change production or install a plan.

Sources: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/ and https://vinext.dev/docs/getting-started/migrating .

**Remaining:** separate-site route allowlist is code-only and intentionally inactive in `proxy.ts`; private two-person Cloudflare Access policy, paid-onboarding detail requirement, individual MFA, Supabase origins/recovery, authenticated per-human audit/gateway, C13/N19 and lawful real-data activation still need exact reviews and approvals. Do not register Cloudflare/enter Alea billing info, provision staff, connect real records, migrate, deploy or send.
