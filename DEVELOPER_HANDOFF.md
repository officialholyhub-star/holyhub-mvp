# HolyHub developer handoff

Prepared 12 September 2026; updated after the GitHub collaboration invitation was accepted. Alea can start with [ALEA_START_HERE.md](ALEA_START_HERE.md). Then read [PRODUCTION_LAUNCH.md](PRODUCTION_LAUNCH.md) for deployment and [BUILD_STATUS.md](BUILD_STATUS.md) for feature boundaries.

## 1. What you are taking over

HolyHub connects people with Christian businesses, brands, creators and events. This release is a **non-payment marketplace MVP**: verified accounts, real lister applications, human approval, product uploads, public discovery and a simple admin-curated events directory. Community/Bible features remain later work.

- **Marketplace target:** `https://app.holyhub.co.uk`.
- **Keep `holyhub.co.uk` and `www.holyhub.co.uk` running.** The existing landing site is a separate project and is not included here.
- **Brand:** original supplied logo, locally hosted Deepgrids Sans, official slogan **Connect. Discover. Grow.** Retain `app/fonts/OFL.txt`.
- **Payments stay disabled.** A Stripe link or API key does not complete marketplace payments.
- **Public catalogue starts empty.** Only real approved businesses and published products belong in production.

### Source and publication status

| Item | Verified state at handoff |
| --- | --- |
| Intended GitHub repository | [officialholyhub-star/holyhub-mvp](https://github.com/officialholyhub-star/holyhub-mvp) |
| Working branch | `codex/full-marketplace-mvp` |
| Application release | Latest reviewed commit on `codex/full-marketplace-mvp`; includes events migration 008 and optional CAPTCHA. Use [PR #1](https://github.com/officialholyhub-star/holyhub-mvp/pull/1), not an earlier handoff archive |
| Local checkout | `C:\Users\matth\holyhub-mvp` |
| GitHub upload | **Uploaded:** invitation accepted; `matthewjeanty` now has write access. The complete source is on `codex/full-marketplace-mvp`, not merged over main |
| Public deployment | **Not completed.** Do not assume existing GitHub `main` contains this release |
| Hosted backend | Existing database is not verified compatible; readiness/missing-table failures remain |
| Hosting access | Browser automation timed out; no authenticated hosting/database setup was completed. A functional GPT Site was requested, not a read-only substitute; compatible Workers output and real backend setup remain necessary |
| Existing landing site | Unchanged by this marketplace work |

GitHub's review branch is the authoritative handoff. It contains the tracked application, assets, lockfile, tests, migrations and these documents, excluding local credentials, dependencies and build output. Earlier source ZIPs predate this finishing pass. **Do not substitute an older ZIP or GitHub's old main branch for this release.**

## 2. First actions for the next developer

1. Obtain named-account access to GitHub, Vercel, the chosen Supabase project and Namecheap. Use invitations, not shared passwords.
2. Review the uploaded `codex/full-marketplace-mvp` branch and its pull request; run CI and preserve existing history/unrelated work. Do not force-push over `main`.
3. Inspect the existing database without changing it. Agree with the owner whether to reconcile it or use a dedicated fresh marketplace project. Back up existing data first.
4. Configure real Supabase Auth/Postgres/Storage and SMTP. The existing deployment configuration targets Vercel; the new request for a functional GPT Site additionally requires compatible Cloudflare Workers output, including safe image processing. Agree the hosting path before changing it. No Stripe integration is needed for this non-payment release.
5. If the Vercel path is agreed, add only the `app` DNS record using that project's supplied values. Complete section 8 on the real HTTPS app before announcing launch; do not modify root/www or email records.

From the existing local checkout, to upload further reviewed changes:

```sh
git status --short --branch
git push -u origin codex/full-marketplace-mvp
```

If receiving only the ZIP, restore its reviewed source into a new branch of a clone of the intended repository. The ZIP has no `.git` directory. Review additions, modifications and removals before committing; do not copy private environment files or overwrite unrelated changes.

## 3. Run and verify

Use **Node.js 24** and npm; keep the supplied lockfile.

```sh
npm ci
npm run demo
```

Open `http://127.0.0.1:3100`. This is an empty, temporary local preview using isolated PostgreSQL-compatible PGlite and a local API adapter. Data resets on restart; no real email is sent. Never enter real personal data, expose its ports publicly or deploy the adapter. Its `/api/health` deliberately returns 503.

For fictional fixtures only, stop the preview and run `npm run demo:samples`; sample accounts are documented in [README.md](README.md). Never run test fixtures against production. For real development, follow README's Supabase setup, configure an ignored `.env.local`, and use `npm run dev` with a separate test project.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium --only-shell
npm run test:e2e
npm run test:marketplace
```

Run browser suites sequentially because they share Next's development build directory. `.github/workflows/ci.yml` runs on pull requests to `main`, pushes to `main`, or manual dispatch; pushing only the work branch does not automatically run it.

**Application verification:** the events/CAPTCHA release (`77d20e3`) passed 38 database/validation/configuration checks, eleven browser journeys, lint, type checking and build locally and in GitHub Actions. The final release-gate pass adds two tests, bringing the automated suite to 51 checks; see PR #1 for the latest result. Layouts were checked from 320 to 1440 pixels. CAPTCHA uses a local provider stand-in; test the real provider after configuration. These isolated checks are **not** evidence of hosted email delivery or a successful deployment.

## 4. Architecture and edit map

Next.js 16.3.4 App Router, React 19.2.8, TypeScript and Supabase SSR sessions. Server actions and route handlers use authenticated Supabase clients. PostgreSQL row-level security and database functions enforce ownership, roles and state transitions. Storage buckets are private; validated images use scoped routes. Production needs no separate custom backend server.

| Area | Main files |
| --- | --- |
| Homepage, typography, colours | `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `app/fonts/` |
| Logo/navigation | `public/holyhub-logo.png`, `components/site-header.tsx` |
| Accounts, confirmation, recovery, sessions | `app/auth/`, `lib/auth/`, `lib/supabase/`, `proxy.ts` |
| Applications and business discovery | `app/account/business/`, `app/businesses/`, `lib/businesses.ts`, `components/business-form.tsx` |
| Products and discovery | `app/seller/products/`, `app/products/`, `lib/marketplace.ts`, `components/product-form.tsx` |
| Moderation/settings/audit | `app/admin/`, `app/notifications/` |
| Uploads and private file access | `app/uploads/`, `lib/image-upload.ts`, `components/image-file-input.tsx`, `app/api/product-image/`, `app/api/evidence/` |
| Order/refund scaffolding | `app/basket/`, `app/orders/`, `app/refunds/`, `app/seller/orders/`, `app/seller/finances/` |
| Disabled payment boundary | `app/api/checkout/route.ts`, `app/api/stripe/webhook/route.ts`, `lib/payments/verify.ts` |
| Database/setup | `supabase/migrations/` (001–008), `supabase/ops/` |
| Events directory and curation | `app/events/`, `app/admin/events/`, `components/event-form.tsx`, `lib/events.ts` |
| Optional auth bot protection | `components/auth-captcha.tsx`, `lib/auth/captcha.ts`, `app/auth/actions.ts`; configuration in README |
| Hosting/readiness | `vercel.json`, `.vercelignore`, `scripts/check-production.mjs`, `scripts/production-config.mjs`, `app/api/health/route.ts` |
| Tests/local adapter | `tests/`, both `playwright*.config.ts` files, `scripts/demo.mjs` |

Read `AGENTS.md` and the relevant installed Next.js documentation before coding. `STAGE_1_DECISIONS.md` and the manual-only `unpack-stage1` workflow are historical; do not run that importer over this release.

## 5. Access and infrastructure

| Service | Owner action | Purpose |
| --- | --- | --- |
| GitHub | Invite developer with write access; invitation must be accepted | Source, review and CI; connected account is currently `matthewjeanty` |
| Vercel | Invite developer to intended project/team with deployment/configuration permissions | Hosting, environments, app subdomain |
| Supabase | Grant appropriate project database/Auth/Storage access | Persistent accounts, listings, images and moderation |
| SMTP provider | Supply approved verified sender; configure credentials privately in Supabase | Confirmation, password reset and email changes |
| Namecheap | Grant scoped management access or have owner apply the supplied record | Add only the app subdomain |
| Stripe | **Not needed for this non-payment launch** | Separate future integration |

The receiving developer's identity is not recorded here; the owner must choose the recipient. Never put passwords, secrets, SMTP credentials or customer exports in chat, Git or this document. No paid subscription or infrastructure purchase has been made by this work.

### Production environment

Use `.env.production.example`; configure values in Vercel or ignored `.env.production.local` for a local preflight:

- `NEXT_PUBLIC_SUPABASE_URL`: selected project's HTTPS URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: matching **publishable** key, never a service-role key.
- `NEXT_PUBLIC_SITE_URL`: `https://app.holyhub.co.uk`.
- `HOLYHUB_LOCAL_DEMO=false`.
- `HOLYHUB_DEMO_SAMPLE_DATA=false`.
- `HOLYHUB_STRIPE_WEBHOOKS_ENABLED=false`.

No service-role or Stripe key is required for this listing release. Public-prefixed values are exposed to visitors and must never contain privileged credentials. SMTP credentials belong in Supabase, not client configuration.

`vercel.json` sets Next.js, `npm ci`, `npm run build:production` and London functions (`lhr1`). Set Node 24. The production build now performs the online read-only hosted checks before compilation and stops on unsafe configuration, provider failures, missing schema/storage/admin or disabled email confirmation. Bootstrap the confirmed owner using the real connected development app before the first deployment, as detailed in PRODUCTION_LAUNCH.md. `--offline` remains only a manual configuration-shape diagnostic, not the deployment path. CI's ordinary build deliberately stays isolated from production services.

### Database and administrator

Previously configured project: `mgzsxzixobyfdlutxtgs`. Read-only checks returned missing-table errors for businesses, product images, platform settings and notifications. Some other requests returned permission errors, which do not prove table absence. Signup and email confirmation were enabled; actual delivery was untested.

**Do not reset or blindly migrate that project.** Use `supabase/ops/inspect-existing.sql`, compare schemas and agree a backup/migration plan. For a confirmed fresh project only, apply migrations **001–008 once, in order**, as listed in [PRODUCTION_LAUNCH.md](PRODUCTION_LAUNCH.md). They insert no fictional sellers, products or events. Existing installations already on 007 need only the reviewed new 008 migration; never replay earlier migrations blindly.

Create and verify the owner's account, then use `supabase/ops/bootstrap-admin.sql` with its actual user UUID. Never trust signup metadata for admin access or promote solely on an email match. Migration 007 adds readiness checks and in-account application notifications.

## 6. Functional boundaries and owner decisions

**Implemented non-payment journey:** verified accounts; lister submission; human approval/rejection; business edits returning to review; product drafts, validated images and approved publication; search/filter discovery; external brand links; in-account moderation notifications. Persistence requires a correctly configured hosted backend.

**Events:** administrators create drafts, review public details, publish, edit back to draft and archive. Visitors can search and read only published events. Recurring schedules are human-readable text with a time zone, not generated occurrences. Assign an administrator to verify organiser links and archive expired/cancelled events.

**Not a working financial service:** baskets, unpaid previews, historical order/fulfilment screens, refund evidence/decisions and fee/reserve/commission records are scaffolding. `/api/checkout` always returns 503. The webhook is disabled by default and rejects live events even in its isolated test mode. Refund decisions do not move money. Connect, payment creation, stock reservation/decrement, transfers, payouts, provider refunds and shipping/tax calculations are not implemented.

Confirmed rules are **10 free product listings, 20p per additional listing and 5% commission**. The initial ten created product records can publish after approval without payments; extra products remain blocked. The owner must still decide how the allowance counts, whether fees recur, shipping/tax policy, reserve settings, appeal rules and liability for payment costs/refunds/disputes. Do not invent defaults or activate payments to complete the listing launch.

Marketplace notification emails/Resend are not connected. Auth email separately depends on Supabase SMTP. The older landing site's Tally, support-payment and email integrations are not included here. Events now have admin curation, search, public pages and organiser links; ticketing and automatic recurrence are not implemented. Community content, loyalty, subscriptions and advanced analytics are not implemented.

## 7. Operations to finish

- Owner approval of operator identity, privacy/terms, data retention and moderation policies before public collection. The included privacy page is not a completed legal review.
- Verified SMTP, correct app callback/recovery URLs and real-inbox testing. Keep confirmation, secure email change and rate limits enabled.
- Optional Turnstile is implemented, including token forwarding, expiry/reset handling and local stand-in tests. Enable the public site key and the matching private Supabase provider setting together; test the actual provider before launch. This does not replace rate limits or an abuse review.
- Keep private bucket policies and independent server upload validation. JPG/PNG/WebP uploads are limited to 4 MB and re-encoded; do not casually raise the limit on Vercel.
- Database backups **plus separate Storage object backups**, a restore rehearsal and an assigned owner. Never store backups in a public repo.
- Spending alerts, error-log review and uptime alerts for `/api/health`. No monitoring automation has been created.
- Separate staging and production data; avoid logs containing tokens or unnecessary personal data.

Keep the previous Vercel deployment for application rollback. A code rollback does not reverse database migrations: use a reviewed forward fix or tested restore, not dropped customer tables. Leave the existing landing site unchanged if an app launch fails.

## 8. Real public-launch acceptance checklist

Use owned test accounts and clearly labelled records on the actual HTTPS deployment:

- [ ] Exact source is on GitHub, intended branch reviewed, CI passes.
- [ ] Schema reconciled, migrations applied safely, verified owner/admin assigned.
- [ ] `npm run check:production` passes; signed-out `/api/health` returns 200. Health is not proof of email delivery or every policy.
- [ ] Signup confirmation, login, password recovery and secure email change work with real inboxes, including another device.
- [ ] A new lister submits a business; admin receives the in-account notification and approves it.
- [ ] Approved seller uploads and publishes an allowed product; signed-out discovery and external brand link work.
- [ ] Another account cannot edit it or access private records; pending/suspended businesses stay hidden.
- [ ] Listing and image survive sign-out, refresh and redeployment.
- [ ] Admin creates/publishes an event; signed-out visitors discover it; saving edits hides it pending re-publication; archiving removes it; ordinary accounts cannot curate events.
- [ ] If CAPTCHA is enabled, real signup/login/recovery and failed-login retries work with the actual provider on the chosen domains.
- [ ] iPhone/Android and desktop flows work; no button promises functioning checkout.
- [ ] App subdomain has valid HTTPS/auth links; root/www site and existing email DNS remain unchanged.
- [ ] Owner approves notices; backups, moderation responsibility and monitoring are established.
- [ ] Test listings unpublished before invitations; payments and demo/sample flags remain off.

The next developer should be able to reproduce the local checks and complete the launch without mistaking a local preview or successful build for a production-tested service.
