# HolyHub marketplace MVP

**Connect. Discover. Grow.**

Next.js 16, React 19, TypeScript, Supabase Auth/Postgres/Storage. The original HolyHub logo is unchanged. This repository is separate from the live holyhub.co.uk landing page; no production deployment or live database changes have been made.

## Taking over this project

Start with [ALEA_START_HERE.md](ALEA_START_HERE.md) for the owner overview and ten-stage progress, then [DEVELOPER_HANDOFF.md](DEVELOPER_HANDOFF.md) for setup, architecture, access requirements and launch checks. The complete source is uploaded on `codex/full-marketplace-mvp`; production backend setup and deployment are still outstanding.

## Production launch

The real-listing launch target is **app.holyhub.co.uk**, keeping the current landing site intact. See [PRODUCTION_LAUNCH.md](PRODUCTION_LAUNCH.md) for the requirements, infrastructure, database operations and remaining live-access blockers. The repository is not a deployed service.

Run `npm run check:production` against privately configured production values before inviting users. Vercel uses `build:production`; it refuses demo configuration. No sample data is added by migrations.

## Empty local preview

Use Node.js 24:

```sh
npm ci
npm run demo
```

Open http://127.0.0.1:3100. It starts with **no listings or accounts**. This is a temporary local preview, not a live signup service.

For explicit developer-only sample fixtures, stop the preview and run `npm run demo:samples`. Only that mode has these test accounts:

| Role | Email | Password |
| --- | --- | --- |
| Customer | customer@holyhub.test | HolyHub-demo-2026! |
| Seller | seller@holyhub.test | HolyHub-demo-2026! |
| Administrator | admin@holyhub.test | HolyHub-demo-2026! |

The preview runs on this computer only. Optional sample products, businesses, images, accounts and a simulated paid order are fictional. Local data is held in memory and resets when the process restarts. It does not contact Stripe, send emails or connect to hosted Supabase. Do not enter real personal information. Stop it with Ctrl+C.

The demo uses the actual SQL migrations and row-level security through a small local API adapter. It does **not** prove live Supabase email delivery, Storage infrastructure or Stripe integration. Never expose its ports (3100/54330), tunnel it publicly or deploy the test adapter. Production builds reject the demo flag.

## Working features

- Signup, login/logout, email confirmation, password recovery, profile/email changes.
- Lister application, owner-editable business profile, admin approval/rejection and public storefronts. Business edits return to review.
- Product drafts, editing, publishing, archiving, images, stock and prices.
- Public product/business discovery, category/search/price filters and product pagination.
- Public events directory with search, recurring schedule descriptions, organiser links and admin-only draft/edit/publish/archive controls. Events are empty by default and do not sell tickets.
- Optional Turnstile integration on signup, login and password recovery, with tokens forwarded to Supabase for provider verification.
- Persistent per-customer baskets and multi-seller **unpaid** order previews.
- Server-calculated line totals, 5% commission and seller-specific allocations; immutable order item snapshots.
- Customer order history and delivery progress; seller order/fulfilment screens and recorded earnings.
- Refund questionnaires, private image evidence, seller responses, human admin decisions and configurable appeals.
- Admin user/seller/product moderation, detailed order breakdowns, reserve settings, fee settings and a read-only audit log.
- In-account notifications for lister reviews, verified test orders and refund activity.
- Private image buckets, file validation/re-encoding, scoped access and server-enforced authorisation.

Archive products instead of deleting financial history. Closing an account in admin removes access; it does not erase records. No automated refund decisions have been implemented.

## Payment status — deliberately not launch-ready for taking money

A Stripe Payment Link is **not** required to build these screens and is not sufficient for a multi-seller marketplace.

- `/api/checkout` always returns 503. The checkout screen cannot accept money.
- `/api/stripe/webhook` is off by default. When explicitly configured for isolated testing, it verifies the raw-body signature, rejects stale/tampered events, matches the stored session, currency and amount, and records an event only once.
- **Live-mode events are explicitly rejected in this build.**
- Customers, sellers and admins cannot mark an order paid through browser requests or admin buttons.
- Refund approvals record decisions and amounts; they **do not send refunds**.
- Additional-listing fees can be recorded as due; they are **not collected** and the unpaid extra product remains a draft.
- Stripe Connect onboarding, actual charge creation, stock reservations/decrements, shipping/tax calculations, transfers, payouts, reversals, disputes and actual refund execution are **not implemented**. Keys alone do not complete these integrations.
- Seller totals are recorded figures, not a promise of immediately available funds. No payout button moves money.

See [BUILD_STATUS.md](BUILD_STATUS.md) for the remaining work and business decisions. The future payments implementation should follow Stripe's [separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers) model and [webhook signature verification](https://docs.stripe.com/webhooks/signature).

## Confirmed pricing and open decisions

The database starts with **10 free product listings, £0.20 per additional listing, 5% commission**.

The owner still needs to confirm whether “10 free” means lifetime listings or currently active listings. Production migrations leave that choice unset and block publishing beyond the allowance until confirmed. Lifetime mode currently counts created product records, including drafts; confirm this interpretation before using it.

Reserve percentages/hold periods and appeal deadline/limit are also unset. Suggested reserve ranges in the specification are not treated as agreed defaults. Configure them in the admin settings after the owner confirms them. Shipping/tax fields record policy notes; they are not calculation engines.

The **optional demo:samples mode only** explicitly uses lifetime allowance, a 15%/14-day new-seller reserve and one appeal within seven days to exercise those controls. These are fictional test settings, not recommended or agreed production policies.

## Connect a real development Supabase project

**Do not blindly apply these migrations to the existing HolyHub project.** Its newer hosted schema has not been reconciled with this repository. Prefer a fresh non-production Supabase project for testing.

1. Copy `.env.example` to `.env.local`. Set the project URL, publishable key and your exact app origin. Local environment files are ignored by Git. Do not put service-role keys in `NEXT_PUBLIC_*` variables.
2. For a **fresh** project, apply these migrations once, in order:
   - `001_stage1_foundation.sql`
   - `002_business_discovery.sql`
   - `003_marketplace.sql`
   - `004_marketplace_storage.sql`
   - `005_payment_boundary.sql`
   - `006_order_delivery.sql`
   - `007_launch_readiness.sql`
   - `008_events_directory.sql`
3. Existing databases require a schema comparison, backup and reviewed migration plan first. Do not rerun applied migrations or drop tables to make them fit.
4. Configure Supabase Auth and Storage below.
5. Run `npm run dev` and open http://localhost:3000.
6. Sign up and verify the intended administrator, then assign their role in the SQL Editor:

```sql
insert into public.user_roles (user_id, role)
values ('REPLACE_WITH_VERIFIED_ADMIN_USER_UUID', 'admin')
on conflict do nothing;
```

Never assign admin roles using signup metadata or a browser form. Keep Supabase's service-role key private; it bypasses row-level security.

## Authentication, storage and notifications

Keep email confirmation enabled. Set the Supabase Site URL to the actual app origin and add its exact callback URL, plus explicitly approved local/preview origins. Avoid broad production wildcards. Configure a verified SMTP sender and test delivery using real test inboxes before launch.

Recommended token-hash email links support opening on a different device:

```html
<!-- Confirm signup -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your HolyHub account</a>
<!-- Reset password -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset your password</a>
<!-- Change email; keep secure email change enabled -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change">Confirm your email change</a>
```

Migration 004 creates private product-images and refund-evidence buckets with policies. The app accepts JPG/PNG/WebP up to 4 MB, validates and re-encodes them, strips metadata and generates scoped object paths. Evidence is available only to case participants and administrators through short-lived links.

Order/refund notifications currently appear **inside the account**, not by email. Supabase SMTP is used for authentication mail only. The older landing page's Tally, Stripe and Resend integrations have not been moved into this separate marketplace.

### Optional bot protection

The frontend and token forwarding are implemented; **the provider is not enabled automatically**. Register the actual app hostname in Cloudflare Turnstile, set its public site key as `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, and configure its private secret in Supabase Authentication → Bot and Abuse Protection, choosing Turnstile. Deploy the frontend configuration and enable the matching Supabase setting together. Never put the private secret in a `NEXT_PUBLIC_*` value or Git.

Supabase must enforce verification on its own Auth endpoints; the app's token-length check is not verification. An empty site-key value leaves current auth unchanged and loads no widget. Tokens are cleared on expiry and refreshed after a completed submission, with visible errors if the widget cannot load. Test signup, login, invalid credentials/retry and recovery with the real configured provider before launch. Browser tests use an isolated widget stand-in and do not prove Cloudflare verification.

See [Supabase CAPTCHA setup](https://supabase.com/docs/guides/auth/auth-captcha) and [Cloudflare widget configuration](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/).

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium --only-shell
npm run test:e2e
npm run test:marketplace
```

SQL tests use ephemeral PostgreSQL-compatible PGlite with the real migrations and role policies. Browser suites cover the original auth/application flow and the expanded product, basket, evidence, refund, appeal and admin flows. All tests use isolated local data and no real payments. Run browser suites sequentially; Next's development build directory is shared.

CI runs these checks with placeholder configuration, not live account keys. Screenshots and traces are in ignored test-results. The historical Stage 1 importer is now manual-only so it cannot automatically overwrite the marketplace.

## Deployment checklist

This is a server-rendered Next.js app, not a static HTML export. Build with `npm run build`; run with `npm start` on Node 24 or a compatible managed host.

Before public launch: reconcile the hosted schema; configure environments, SMTP and authentication URLs; confirm policies; complete and test payments if taking money; review the operator identity, terms, privacy/refund notices and data retention; test backups/restoration, moderation and abuse limits; test mobile Safari/Chrome and real provider callbacks. The included privacy text is a factual starting point, not a complete compliance review.

Do not deploy the local demo or overwrite the existing landing site. A separate app subdomain can be configured when the owner approves deployment.

## Editing map

- Home copy: app/page.tsx
- Colours, spacing, responsive styles: app/globals.css
- Typeface: app/layout.tsx and app/fonts/ (supplied Deepgrids Sans, locally hosted; the logo is unchanged)
- Logo: public/holyhub-logo.png (unchanged)
- Navigation and contact: components/site-header.tsx, app/layout.tsx
- Product validation/categories: lib/marketplace.ts (keep SQL constraints in sync)
- Product editor: components/product-form.tsx, app/seller/products/
- Customer discovery/orders/refunds: app/products/, app/basket/, app/orders/, app/refunds/
- Admin: app/admin/
- Public events and curation: app/events/, app/admin/events/, components/event-form.tsx, lib/events.ts
- Optional auth bot protection: components/auth-captcha.tsx, lib/auth/captcha.ts, app/auth/actions.ts
- Database permissions and state transitions: supabase/migrations/
- Signed payment boundary: app/api/stripe/webhook/, lib/payments/
