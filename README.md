# HolyHub Platform

HolyHub is a Christian platform built around three clear areas: **The Hub, Marketplace and Events**.

> **Current product source of truth:** see [HOLYHUB_MASTER_SPEC.md](./HOLYHUB_MASTER_SPEC.md). Older stage documents are historical and should not override the master spec.

The application is intended to sit at `app.holyhub.co.uk` later. It remains separate from the existing `holyhub.co.uk` landing page.

## Current build

The current working branch includes:

- Next.js + TypeScript
- Supabase Auth/database foundation
- customer/lister role model
- signup, login, logout, confirmation and password reset
- lister applications and lister access
- storefront and product management
- Marketplace search/filter/product pages
- basket and Stripe Checkout
- Stripe webhook payment status tracking
- three-section navigation: The Hub | Marketplace | Events
- Verse of the Day on The Hub and homepage
- responsive HolyHub styling

See the master spec for features that are decided but not yet implemented.

## Local/Codespaces setup

1. Copy `.env.example` to `.env.local` and add the required Supabase/Stripe values.
2. Apply migrations in `supabase/migrations` in numerical order for a fresh database.
3. Install packages with `npm install`.
4. Start locally with `npm run dev`, or in Codespaces with `npm run dev:codespace`.
5. Open port 3000.

For Stripe testing you need:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

Never expose server-only secrets to browser code.

### Stripe TEST webhooks in Codespaces

A successful Checkout redirect does not create an order. `/api/stripe/webhook` must receive a signed `checkout.session.completed` (or `checkout.session.async_payment_succeeded`) event with `payment_status=paid`. The existing `process_checkout_payment` database function atomically creates the customer order, seller orders and item snapshots, updates payment status and inventory, and makes duplicate delivery idempotent. Customer identity comes from the server-owned checkout snapshot; `holyhub_user_id` is also sent in Stripe metadata.

Install [Stripe CLI](https://docs.stripe.com/stripe-cli), keep `STRIPE_SECRET_KEY` set to `sk_test_...`, then use either:

- `npm run dev:stripe` to start the app on port 3000 and a TEST listener together. The command supplies the matching signing secret to the app automatically without changing `.env.local`.
- With `npm run dev` already running on port 3000, run `npm run stripe:listen` in a second terminal. This sets `STRIPE_WEBHOOK_SECRET` in `.env.local` to the CLI listener's signing secret when needed. Restart the app if it does not reload the environment file automatically.

Keep the listener running while testing. It forwards only the four supported checkout events to `http://127.0.0.1:3000/api/stripe/webhook`, prints delivery HTTP statuses, and redacts credentials. It never enables `--live`. Stop an existing app before using `dev:stripe`; both commands assume port 3000. CLI forwarding works with a private Codespaces port and requires no Stripe Dashboard webhook destination. Defining `STRIPE_WEBHOOK_SECRET` alone does **not** configure delivery. If using a Dashboard destination instead, register a publicly accessible HTTPS `/api/stripe/webhook` URL in Stripe test mode and use that destination's signing secret, which is different from the CLI secret. See [Stripe webhook setup](https://docs.stripe.com/webhooks).

Run `npm run stripe:diagnose` for read-only TEST session, snapshot, order and webhook-destination diagnostics. It prints identifiers/counts/statuses, never secrets, customer emails or delivery addresses. `pending_webhooks=0` alone does not prove delivery; there may be no registered destination.

To recover an already-paid test checkout after starting the app, use `node scripts/stripe-test-replay.mjs evt_...` with its real `checkout.session.completed` event ID. This verifies the event and current payment against Stripe TEST API and its saved checkout snapshot, then performs a signed **local replay** through the normal webhook route. It can create test orders and decrement their product inventory. It never fabricates payment, calls a live Stripe API or applies schema changes. Replaying the same event again must leave one logical order. This verifies local handling, not Stripe-origin delivery; complete a new browser test checkout with the listener running to verify automatic forwarding. A generic `stripe trigger checkout.session.completed` fixture has no HolyHub checkout snapshot and should fail instead of creating an order.

The server logs `Stripe webhook received` and `Stripe webhook processed` with event/session/order IDs. Verification/configuration/transaction failures have safe diagnostics and return errors (database failures return 500 for retry). Raw payloads, signing secrets, customer metadata and addresses are never logged. Use these IDs to investigate further in Stripe Workbench and Supabase logs.

When the app is ready for its subdomain, update `NEXT_PUBLIC_SITE_URL` and the Supabase allowed URLs to `https://app.holyhub.co.uk`.

### Password reset setup and testing

In Supabase **Authentication → URL Configuration**, allow these callback URLs:

- `http://localhost:3000/auth/callback**` (add another local port if used)
- `https://*-3000.app.github.dev/auth/callback**` for Codespaces development
- `https://app.holyhub.co.uk/auth/callback**` for production

Use the production domain as Supabase's Site URL when launching. Development requests and callbacks use the current localhost/Codespaces host; production uses `NEXT_PUBLIC_SITE_URL`. No individual Codespaces URL is hard-coded. Supabase must allow the callback including its `?next=/auth/reset-password` query; otherwise it may fall back to the Site URL. See [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

Keep the Reset Password email template's normal `{{ .ConfirmationURL }}` link. The app verifies its PKCE code and opens Set new password directly. Open the link in the browser where you requested it, because PKCE requires that browser's verifier cookie. A custom template can instead link to `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`; the callback verifies that recovery token with Supabase, including when opened in another browser.

The server signs a one-hour recovery cookie after verification and requires it alongside a Supabase-validated user before accepting a new password. Set server-only `AUTH_RECOVERY_SECRET` to a stable random secret of at least 32 bytes across all instances, or retain the existing server-only `SUPABASE_SERVICE_ROLE_KEY` as the signing fallback. Never use a public environment variable for either secret.

The forgot-password screen shows a neutral confirmation, including for unknown accounts, and offers Resend reset email. Passwords require 8–128 characters and matching confirmation. After updating, the recovery cookie is removed, the session is signed out, and Login shows “Password updated successfully.” Invalid/expired links return to the email form with a clear request-new-link message.

Run `node --test tests/password-reset.test.mjs`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`. To verify delivery end to end, use an account whose inbox you can access: request a reset, check inbox/spam, open the link, exercise short/mismatched passwords, update successfully, then log in with the new password. Reopening the consumed email link should display the expired/invalid message. Check both forms at a narrow mobile viewport. Email delivery requires a working Supabase email provider/SMTP configuration and is subject to Supabase rate limits.

## Historical files

`STAGE_1_DECISIONS.md` and older stage-labelled notes are retained for history. They are not the current product source of truth.

Stripe checkout return URLs use the current Codespace's forwarded host in development (including its actual forwarded port), or the local request host outside Codespaces. They ignore the browser's `Origin` header. Other environments use `NEXT_PUBLIC_SITE_URL`; set this to the deployed HTTPS app URL in production. For a custom development proxy, set it to the public app URL. Run `npm run dev:codespace` for the environment-derived Codespaces fallback. Stripe receives `/checkout/success?session_id={CHECKOUT_SESSION_ID}` and `/checkout/cancelled` when each session is created; start a new checkout after changing the configuration. Existing sessions keep their original return URLs. Keep `STRIPE_SECRET_KEY` set to a test key while testing. No Stripe Dashboard return-URL change is required; webhook delivery configuration is separate.
