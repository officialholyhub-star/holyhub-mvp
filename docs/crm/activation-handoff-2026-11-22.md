# N18 — single private CRM activation package
Date: 22 November 2026 (target: Monday 23 November). Active human: Anais. Authority: A-224/A-222. Hosting **chosen**: Netlify, database stays Neon. This document records a **proposed configuration awaiting specific decisions**, not approval to deploy, bind real identities, wire credentials or process real records.

## Completed technical baseline — do not rebuild
- CRM branch: `anais/n18-crm-sandbox`; latest A-224 evidence: `docs/crm/approval-2b-readiness.md`. Green CI before this handoff: https://github.com/officialholyhub-star/holyhub-mvp/actions/runs/45029614411.
- Neon sandbox: project `flat-band-06724960`, default branch `br-floral-wave-za3jo7o0`, database `holyhub_crm`, `system_environment=sandbox`. The Drizzle journal has exactly two verified history rows (0000/0001) and no schema migrations were replayed.
- Retain recovery branch `br-weathered-forest-zafk3uti`. Current live records are fictional only. No real Supabase staff subject was bound.
- Existing Next.js CRM console is at `/admin/crm` and bounded API at `/api/crm/operate`; `requireCrmUser()` verifies the logged-in Supabase user against an active internal user with exact subject and role. There is no real-user self-provisioning.

## Decision A — Alea (not approved): isolated Netlify deployment and website-side auth

**Approve exactly** creating a *new, distinct, access-restricted* Netlify project (proposed name `holyhub-crm-sandbox-private`; actual subdomain must be confirmed), linked only to GitHub repo `officialholyhub-star/holyhub-mvp` and deploying the tested `anais/n18-crm-sandbox` ref. The existing Netlify website `bright-otter-98fa94`, its publish locks, domains, configuration and Alea's branches remain untouched. No merge into `main`.

| Setting | Proposed exact value / requirement |
|---|---|
| Provider and site | Netlify, **new site** `holyhub-crm-sandbox-private` (name subject to availability) |
| Repository | `officialholyhub-star/holyhub-mvp` |
| Site production Git branch | `anais/n18-crm-sandbox` for **this separate private site only**; never the marketplace |
| Base directory | repository root `.` |
| Framework | Next.js 16, built-in Netlify OpenNext adapter; no added legacy plugin |
| Node.js | `NODE_VERSION=24` |
| Build command | `npm run build` (automatic dependency install from committed lockfile) |
| Publish directory | `.next` (Next.js SSR/hybrid); no `next export` |
| Visibility | **Private for production AND preview deploys before first publish**, Netlify-account login required; not public/unlisted-by-URL |
| Access | Anais alone as the intended CRM user; Alea retains necessary Netlify owner/admin operational oversight. Grant only required Netlify project role, require account MFA. Confirm plan/seat capacity first. |
| Other deploys | Disable unrelated PR/branch deploys on this new site; after first reviewed private deploy, lock auto-publishing and use explicit reviewed deploys |
| Domain | generated isolated `https://<confirmed-name>.netlify.app`; NO main HolyHub domain |
| URL entry | `/admin/crm`; unauthenticated access must require sign-in; `/api/crm/operate` must reject unmapped users |
| Website side | Existing Supabase publishable app credentials, session handling and `/auth/login` must be confirmed by Alea for *this isolated origin*. `NEXT_PUBLIC_SITE_URL` must equal the confirmed isolated https origin; approved redirect/callback allowlist only if required. No new auth flow or website config change without Alea-specific authority. |
| Non-CRM pages | The repository contains the **whole HolyHub website**, not a CRM-only bundle. Before release, Alea must accept/approve how non-CRM routes are restricted on the new site and ensure no existing live payment, seller, customer or email integrations can operate there. Private-site protection alone does not disable these routes. |

**Blocking account fact:** Netlify's current credit-based Free/Personal private projects are single-seat (Team Owner only); invitee access requires a plan with project collaborators (e.g. Pro). Do not purchase/upgrade without Alea. Confirm the team's actual plan, protection and identity roles before deployment.

**Suggested Alea decision wording:** “I approve an entirely separate Private Netlify project, `holyhub-crm-sandbox-private` (or an available equivalent), attached only to `anais/n18-crm-sandbox`, for fictional-data CRM testing. Verify my plan supports Anais's private access, restrict all site routes and deploys, and make only the specifically reviewed Supabase auth/origin changes necessary for this isolated preview. Leave the existing website, production domains and current deploy locks untouched.” Adapt/review any necessary website-side implementation *before* acting.

## Decision B — Anais (not approved): exact secret-store destination

**Proposed exact destination:** **Netlify → the new isolated site `holyhub-crm-sandbox-private` → Project configuration → Environment variables → site-scoped variables**, not shared team variables, GitHub Actions secrets, `netlify.toml`, repository `.env`, public `NEXT_PUBLIC_` variables or chat.

- `CRM_DATABASE_URL`: connection for `hh_crm_api_runtime` on the existing isolated Neon sandbox `holyhub_crm` only. **Mark Contains secret values** in Netlify Secrets Controller. On a plan supporting variable scopes, choose **Functions only**; deny Builds and Post-processing. Never echo, paste or log its value. This role is not owner, creator, superuser or BYPASSRLS.
- `CRM_ENVIRONMENT=sandbox`: server-side, ideally Functions scope; the CRM code must match the DB `system_environment=sandbox` marker. Not a secret.
- `NEXT_PUBLIC_SITE_URL`: the exact confirmed https origin of this isolated private Netlify site; public config, not a secret.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: only Alea-verified existing Supabase public credentials for the approved isolated session flow; build and function availability as required; **never** use a Supabase service-role key.
- `NODE_VERSION=24`: Builds scope.
- Do **not** inherit or add Stripe secret keys, live Gmail/Tally/HubSpot credentials, webhooks, live marketing integration tokens or a production Neon URL.

Netlify currently gates per-variable **Functions-only scopes to Pro/Enterprise**; on a lower plan, do not silently substitute a broad all-scopes secret. Review plan/capability and risk first. Next.js SSR is handled by Netlify functions; functions can read variables from the Functions scope. A new private deployment is needed for changed runtime variables to take effect.

**Suggested Anais decision wording:** “I approve Netlify's site-specific Project configuration → Environment variables on the new Alea-approved Private CRM project, with `CRM_DATABASE_URL` marked Contains secret values and restricted to Functions scope for `hh_crm_api_runtime` on the existing Neon sandbox, plus `CRM_ENVIRONMENT=sandbox`. No other store or credential use is approved.” This is **storage destination approval only**, not approval to deploy, bind identity or import records.

## N19/C13 prerequisites to Anais-only staff binding

**N19** remains `In progress` in the LIVE Task Book. Record a witnessed, controlled Anais-vs-Alea concurrent-chat test confirming that the active human stays locked, handover is explicit, read-before-write protects concurrent canonical changes, and account/connector ownership is not mistaken for speaker identity. Evidence must be recorded before claiming the guard cleared.

**C13 staff-security/privacy** remains `In progress` and Alea-owned. Before binding Anais, check and record these *narrow CRM staff-access elements*, not blanket closure of all customer-facing C13 work:
1. Owner-verified identity: Anais has a distinct existing Supabase user ID, active permitted profile and independently confirmed staff ownership; bind exact `auth_provider=supabase` + `auth_subject=<verified user UUID>`, not an email-derived guess. No Alea binding.
2. 2-step authentication, verified second factor/session strength, recovery ownership, revocation and lost-device procedure; don't claim MFA enforced by the existing CRM code unless an explicit tested control exists. Current `requireUser()` and CRM mapping **do not by themselves prove MFA**. If implementing MFA challenge requires Alea-owned auth/UI changes, request her specific approval.
3. Minimal staff identity data (subject, display name, role, active state), role `crm_admin` or `crm_operator` as individually justified; least-privilege review; audit actor attribution and approved retention/access/incident treatment.
4. Explicit authorised access limited to Anais and recorded ownership for adding/revoking users. Test disabled/unmapped user denied and that a lower role cannot mutate or clear a safety hold. Account credentials remain outside Neon.

**No new staff mapping can be written until N19 and applicable C13 controls are verified**, even if Netlify and secret-store decisions pass.

## One continuous conditional activation sequence (AFTER both specific approvals AND gates)

1. Alea creates/configures the new private site and verifies account plan/visitor access, route isolation, staff Supabase auth/redirect. Anais separately approves the site-local secret store and scopes.
2. Set variables securely **without displaying values**; lock down deploy and absence of inherited production secrets. Confirm exact branch SHA and CI are green. Deploy only to the new private site after Alea's specific approval.
3. Verify Anais's actual Supabase auth subject, session security, N19/C13 documentation, then insert **only** her approved staff binding in `crm_config.internal_users` with appropriate CRM role and audit evidence. Do not bind Alea or use fictional records as staff identity.
4. Real browser QA on Netlify (not infer from CI): private-site team login, Supabase sign-in, all seven CRM tabs, fictional organisation/contact/route/follow-up/safety, audit and revocation; deny an outsider; verify all API mutations reject unauthorised actors; check no credentials in page source, bundles or logs.
5. Record a clear acceptance result. Leave the site Private, auto-publishing locked and Neon sandbox-only. Restore access by disabling the staff mapping and/or unpublishing the isolated preview if tests fail; rotate sandbox credentials if exposed. Recovery branch remains untouched.

## Still excluded under A-224

No Alea CRM viewer, no public website release, no website code/config writes by Anais, no real HolyHub contact/lister/customer/subscriber records, no live Gmail/Tally/HubSpot/subscriber integration, no outbound sends, no HubSpot source-of-truth change, and no GATE-007 cutover.

**Future schema note:** Drizzle's standard migrate command can emit `CREATE SCHEMA IF NOT EXISTS drizzle`, rejected under the restricted migrator's database CREATE denial even though history is reconciled. Do not broaden permissions or execute future schema migrations without a separate safe method. No new migration is needed to access the existing CRM.

**Evidence links:** 2B technical readback `docs/crm/approval-2b-readiness.md`; live Task Book A-224/N18; Supabase MFA docs and Netlify private-project, site-env and Functions-scopes product docs verified 22 Nov 2026.
