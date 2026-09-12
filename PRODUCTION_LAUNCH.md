# HolyHub real-listing launch

## Product boundary

Target: **https://app.holyhub.co.uk**. The existing holyhub.co.uk landing page and its DNS records stay unchanged.

This release is a non-payment marketplace: people can create a verified account, apply as a business, prepare products, and publish after human approval. Visitors browse actual approved businesses and published products and can visit the brand's own website. There are no default sellers, sample products, fabricated orders or public demo credentials.

Deepgrids Sans, the original HolyHub logo and Connect. Discover. Grow. are retained.

### Acceptance requirements

- Signup and password-reset emails reach real inboxes. Unverified accounts cannot sign in.
- Each user can edit only their own profile, business, products and images.
- Applicants start pending. An administrator reviews the application. Product publishing remains blocked before approval.
- A submitted business is saved in hosted PostgreSQL, survives app restarts and is visible to reviewers.
- Product images are uploaded to private Supabase Storage and remain available across deployments.
- Only approved, active businesses and visible published products appear publicly.
- A rejected or suspended business is not public. Editing business content returns it to review.
- Reviewers get in-account application notifications. Review results are also recorded in the applicant's account.
- Empty discovery views invite the first real listers; backend failures are shown separately from empty results.
- A public product links to the brand's approved website. HolyHub checkout and automatic money movement stay off.
- Mobile navigation, signup, listing forms, image uploads and discovery work without horizontal overflow.
- Administration, deployment configuration, private data and service credentials cannot be controlled from signup metadata.

The confirmed commercial settings remain 10 free product listings, 20p extra listing fee, 5% commission. The first 10 product records can publish after approval without payment setup; extra listings are blocked pending the unresolved allowance policy/payment implementation. No fees are silently waived. Lifetime vs active allowances still need an owner decision.

## Infrastructure included

| Component | Implementation |
| --- | --- |
| Web application | Existing Next.js 16 app, Node 24; Vercel configuration in vercel.json, London function region |
| Persistent accounts/data | Supabase Auth/PostgreSQL; migrations 001–008 |
| Persistent files | Private product-images and refund-evidence buckets, ownership policies and validated uploads |
| Email | Supabase Auth using a verified custom SMTP sender; no demo mail adapter in production |
| Moderation | Existing protected /admin application queue, account roles, audit history |
| Health | /api/health returns 200 only when schema, RLS, private product storage and a verified active admin are present |
| Preflight | npm run check:production; read-only hosted checks, no credentials printed |
| Build gate | Vercel runs build:production, rejecting demo endpoints, sample-data flags, placeholder or secret public keys |
| Tests | Existing account/browser/SQL checks plus empty-database first-listing and production-config checks |

The SQL operations in supabase/ops are owner-run templates, not automatic migrations or public endpoints.

Image forms reject files above 4 MB before sending and validate them again on the server. This leaves room for form data under Vercel's 4.5 MB request limit. Existing private bucket limits remain intact.

## Live-access findings (12 September 2026)

- The configured Supabase project is mgzsxzixobyfdlutxtgs. Its public API returned missing-table errors for businesses, product_images, platform_settings and notifications. Other tables had permission errors; this does not establish whether they are absent.
- Auth signup is enabled and email confirmation is required. SMTP delivery has not been verified.
- GitHub access is now resolved: the matching invitation was accepted, write access verified, and the complete codex/full-marketplace-mvp branch pushed to officialholyhub-star/holyhub-mvp. Main remains unchanged.
- Browser access timed out, so no authenticated Supabase, Vercel or Namecheap changes were made.

**This document and the local tests do not mean the app is live.** Do not send real people to the loopback preview.

## Safe deployment sequence

### 1. Select and inspect the database

Use a dedicated Supabase project for the marketplace, ideally in the UK region to match the app. Confirm any plan/charges with the owner before provisioning. Do not delete, reset or blindly migrate the current project.

For the existing project, run supabase/ops/inspect-existing.sql in its SQL Editor, compare the resulting schema with this repository, take a backup and review a migration plan. Do not run 001 against existing conflicting tables.

For a confirmed fresh project, apply these files once, in order through the SQL Editor:

1. supabase/migrations/001_stage1_foundation.sql
2. supabase/migrations/002_business_discovery.sql
3. supabase/migrations/003_marketplace.sql
4. supabase/migrations/004_marketplace_storage.sql
5. supabase/migrations/005_payment_boundary.sql
6. supabase/migrations/006_order_delivery.sql
7. supabase/migrations/007_launch_readiness.sql
8. supabase/migrations/008_events_directory.sql

Do not run any file in tests/fixtures on the hosted database. Deployment must never run a database reset or seed.

### 2. Configure authentication and real email

In Supabase Authentication:

- Set Site URL to https://app.holyhub.co.uk.
- Allow https://app.holyhub.co.uk/auth/callback and its next-path variants. Use a narrowly scoped callback wildcard if required, never a domain-wide production wildcard.
- Add only the exact staging/preview origins needed for testing; never point a staging build at production accounts.
- Keep email confirmation and secure email change on.
- Configure verified custom SMTP; the default test mail service is not an unrestricted production mail sender.
- Set sender name HolyHub and a verified sender address the owner controls. SMTP credentials stay in Supabase, not Git or browser code.
- Keep Auth rate limits enabled. The optional Turnstile widget and token forwarding are now implemented. Configure NEXT_PUBLIC_TURNSTILE_SITE_KEY and the matching private Turnstile secret in Supabase Auth together; see README. Do not enable only the provider or assume the local test stand-in proves real challenge verification.
- Test signup, forgotten password and email change with owned test inboxes on another device.

Token-hash template examples are in README.md. Test that links return to this marketplace, not the older landing site or localhost.

### 3. Deploy the existing Next.js app

The source is now uploaded on codex/full-marketplace-mvp. For this documented Vercel path, import officialholyhub-star/holyhub-mvp and use the reviewed branch/commit, not the old main branch. The later request for a functional GPT Site requires a separate compatible Workers build and image-processing assessment; see ALEA_START_HERE.md. Do not publish a read-only copy or expose the demo as a substitute.

Set Node 24 and the values in .env.production.example through Vercel's environment settings. Use the matching project URL and **publishable** key; do not expose a service-role key. This listing release does not require a Stripe key.

Keep previews protected while setup is incomplete. The Vercel project reads vercel.json and runs the production configuration gate before building. Build success alone is not a launch sign-off.

Create and confirm the intended owner's account, then run supabase/ops/bootstrap-admin.sql in the chosen project's SQL Editor after replacing its UUID. The template refuses the placeholder and unverified users. Never assign admin access automatically by matching an email address.

### 4. Add only the app subdomain

Add app.holyhub.co.uk to the Vercel project. In Namecheap, set only the app record to the exact target Vercel supplies. Do not copy a guessed CNAME target, change nameservers, or alter @, www, MX or existing email-verification records.

Wait for Vercel to verify domain ownership and HTTPS. Keep the old landing site running.

### 5. Verify before inviting people

Run npm run check:production with the deployed environment privately configured. The online check must pass; --offline checks only value shapes.

Then test on the actual HTTPS app:

- New account → received confirmation email → login → submit business.
- Admin receives an in-account notification → reviews and approves it.
- Seller uploads an image → publishes a first product.
- A signed-out visitor discovers the brand/product and can open its website.
- Refresh, sign out/in and redeploy: the listing and image must still exist.
- Another account must not be able to edit it. Unapproved/suspended businesses must stay hidden.
- Password recovery and account-email changes must work on phone and desktop.
- If Turnstile is enabled, verify the actual provider on signup, login, failed-login retry and recovery. Missing/expired tokens must not succeed.
- Admin saves an event draft, publishes it, edits it back to draft and archives it; anonymous visitors see only published events and can follow the organiser link. Event schedules are human-maintained descriptions, not automatic recurrence or ticket sales.
- /api/health must return 200 without cookies. It is a readiness signal, not proof of SMTP delivery or every security policy.

Use only owner-controlled test accounts and clearly labelled test records; unpublish those records before inviting the public.

## Operations and unresolved launch gates

- Confirm the actual operator identity, privacy notice, lawful basis, retention and customer/lister terms with the owner before collecting public personal data. The current notice is not a completed legal review.
- Configure host spending alerts and limits. Choose an appropriate commercial hosting plan; no paid subscriptions were purchased.
- Check Supabase database backup coverage and perform a restore rehearsal. Database backups do not include the stored image objects; provide a separate private Storage backup/export process.
- Configure uptime alerts for /api/health with the owner's monitoring service, and review Vercel/Supabase error logs. No recurring monitor has been created automatically.
- Use separate production and test environments; keep diagnostic logs free of passwords, tokens and unnecessary personal data.
- Keep the previous working Vercel deployment for application rollback. Database changes require a reviewed forward fix or tested restore; do not drop customer tables to roll back.
- Application-review notifications are in-account. Marketplace event emails/Resend are not connected.
- Real Stripe checkout, stock reservation, Connect, payouts, provider refunds and fee collection remain a separate implementation. Do not switch on live events or claim that supplying keys completes them.

## Commands and sources

npm run demo starts an **empty, temporary local preview**. It never sends email and must not receive real personal data.
npm run demo:samples explicitly enables fictional fixtures for development only.
npm run build:production validates production configuration and builds; it does not deploy.
npm run check:production checks hosted readiness without changing it.

Official infrastructure guidance:
- [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json)
- [Supabase environments and migrations](https://supabase.com/docs/guides/deployment/managing-environments)
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase database backup scope](https://supabase.com/docs/guides/platform/backups)
- [Vercel request-size limits](https://vercel.com/docs/functions/limitations)
