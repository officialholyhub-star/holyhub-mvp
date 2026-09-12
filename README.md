# HolyHub MVP

**Connect. Discover. Grow.** A Next.js + Supabase app for Christian business discovery.

This is separate from the existing `holyhub.co.uk` landing page. It is intended for `app.holyhub.co.uk` when the owner chooses to launch it. Nothing in this repository deploys over the landing page.

## What is included

- Signup, login, logout, email confirmation, password recovery, profile and email changes.
- Public discovery with search, eight categories, pagination and individual business pages.
- One business profile per account, with owner editing and clear review status.
- A small, admin-only queue to approve, reject or unpublish listings.
- Database-enforced ownership and permissions; only approved businesses belonging to active accounts are public. Editing a listing sends it back for review.
- Responsive HolyHub styling, the original logo, contact links, loading/error/empty states and a basic data-use notice.
- Automated validation, SQL-permission and browser tests.

There are no products, carts, checkout, commissions, paid listings, vendor payouts or customer payments. Visitors contact businesses on their own websites. The original Tally/Stripe/Resend landing-page integrations are not migrated into this separate app.

## Run locally

Use **Node.js 24**.

1. Create `.env.local` from `.env.example`. Set the Supabase project URL, **publishable** key and `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. Never use a service-role key in a `NEXT_PUBLIC_*` variable.
2. Run `npm ci`.
3. Apply the database migrations below and configure authentication.
4. Run `npm run dev` and open `http://localhost:3000`.

The tracked `.env.development` contains the original project's public configuration. Local overrides belong in `.env.local`, which is ignored by Git. Production does not load `.env.development`; configure all three variables on the host.

## Database setup — required before real listing submissions

In the correct Supabase project's SQL Editor:

1. For a new project only, run `supabase/migrations/001_stage1_foundation.sql`.
2. Run `supabase/migrations/002_business_discovery.sql` once. If Stage 1 already exists, **do not rerun 001**. Migration 002 adds the business table and policies without dropping existing account data.
3. Sign up through the app and confirm the intended HolyHub administrator's email.
4. Find that person's UUID in Supabase Authentication → Users. Assign the admin role from SQL Editor, replacing the placeholder below:

```sql
insert into public.user_roles (user_id, role)
values ('REPLACE_WITH_VERIFIED_ADMIN_USER_UUID', 'admin')
on conflict do nothing;
```

Do not use signup metadata or browser code to assign admin roles. Visit `/admin` after logging in as that verified account. Review the business details and destination link before approval; this is not an automated verification service.

## Authentication setup

In Supabase Authentication:

- Keep email confirmation enabled and set the production **Site URL** to the actual deployed app origin (for example `https://app.holyhub.co.uk`).
- Allow `http://localhost:3000/**` for local development. Add the exact production callback URL `https://app.holyhub.co.uk/auth/callback` and, where needed, explicitly approved preview origins. Avoid broad production wildcards.
- Configure a verified custom SMTP sender for public signup and recovery emails. The app relies on Supabase for these emails; the built-in development sender is not a production delivery setup.
- Confirm the password policy and authentication rate limits. Enable additional abuse protection as needed; CAPTCHA integration is not included in this MVP.

Recommended email template links use token hashes so confirmations also work when opened in a different browser:

**Confirm signup**
```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your HolyHub account</a>
```

**Reset password**
```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset your password</a>
```

**Change email**
```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change">Confirm your email change</a>
```

Keep secure email change enabled. It may require confirmation at both email addresses. The `/auth/callback` route also supports Supabase's default PKCE email links when opened in the browser that initiated the request. `/auth/confirm` validates the token type and constrains redirects to this app.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium --only-shell
npm run test:e2e
```

`npm test` runs the actual SQL migrations in a temporary PostgreSQL-compatible PGlite database, then tests anonymous access, ownership, approval, stale-review prevention, editing and suspended accounts. It also tests validation and redirect safety.

Browser tests start their own app on port 3101 and an isolated Supabase API double on port 54329. They do **not** create real accounts, send emails or change hosted data. These validate application journeys, not the live provider's email delivery or settings. Screenshots and failure traces are saved under ignored `test-results/`. GitHub CI runs the same checks.

## Launch checklist

- [ ] Apply migration 002 to the live Supabase project and assign the correct administrator.
- [ ] Configure production environment variables, authentication URLs, email templates and SMTP.
- [ ] Review `/privacy` with the operator: add the appropriate operator identity, contact/address details, retention periods, lawful bases and rights/complaint information before public launch. The included short data-use notice is not a complete legal compliance review.
- [ ] Confirm backup, restore, moderation, account closure and data-request processes. Closing a user in Supabase hides their business; deleting their auth user cascades their profile and listing. Handle these requests manually with verified ownership in this MVP.
- [ ] Test signup confirmation, login, email change and password reset using a real test inbox on the deployed origin, including a link opened on another device.
- [ ] Test one real business submission → approval → discovery → edit → re-review.
- [ ] Verify mobile Safari/Chrome and desktop, and review Supabase logs/usage limits.

For a Next.js-compatible host, the build is `npm run build`, the server command is `npm start`, and the runtime is Node 24. This app is **not a static HTML export**. Connect a separate app subdomain only when the owner approves deployment; keep the existing landing page intact.

## Where to make small edits

- Home copy: `app/page.tsx`
- Colours, spacing and text sizes: `app/globals.css`
- Logo: `public/holyhub-logo.png` (kept unchanged)
- Navigation/contact: `components/site-header.tsx`, `app/layout.tsx`
- Categories and input limits: `lib/businesses.ts` (keep category rules in migration 002 in sync)
- Business submission: `components/business-form.tsx`, `app/account/business/`
- Discovery: `app/businesses/`
- Review queue: `app/admin/`
