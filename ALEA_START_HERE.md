# Alea — start here

## What has been handed over

The HolyHub marketplace source is now uploaded to your [GitHub repository](https://github.com/officialholyhub-star/holyhub-mvp/tree/codex/full-marketplace-mvp), on **codex/full-marketplace-mvp**. Matthew's GitHub collaboration invitation was accepted and write access verified on 12 September 2026. The existing main branch and the separate holyhub.co.uk landing site were not overwritten.

This is a real Next.js/Supabase implementation, not a collection of design screenshots. However, the saved local preview uses a temporary test backend. **The production marketplace is not yet live.** A public read-only substitute was offered and declined; no such substitute has been published.

Read these documents in order:

1. **This page:** owner overview, exact progress and first steps.
2. [DEVELOPER_HANDOFF.md](DEVELOPER_HANDOFF.md): setup, architecture, file map, tests, access and safeguards.
3. [PRODUCTION_LAUNCH.md](PRODUCTION_LAUNCH.md): database inspection, migrations, email, hosting and go-live checklist.
4. [BUILD_STATUS.md](BUILD_STATUS.md): implemented features, financial boundaries and unresolved business decisions.
5. [README.md](README.md): running locally, development configuration and commands.

## Progress against the original ten stages

“Built locally” means implemented and tested against the isolated local backend, not production sign-off. The local-stage summary is **three built, five partial, two not started**.

| Stage | Done | Still required |
| --- | --- | --- |
| 1. Foundation, accounts, security — built locally | Signup, login, confirmation/recovery flows, profiles, role checks and database ownership policies | Reconcile hosted schema, configure real SMTP and verify hosted authentication/security |
| 2. Listers/storefronts — built locally | Applications, human approval/rejection, owner editing, re-review and publication restrictions | Set up verified real administrator and test the complete live approval journey |
| 3. Products/marketplace — built locally | Draft/edit/archive, images, categories, search, filters and public discovery; no default fake listings | Verify real hosted Storage, first approved publication and persistence across redeployments |
| 4. Basket/Stripe checkout — partial | Multi-seller baskets, unpaid previews, trusted totals and isolated signed-webhook checks | Checkout Sessions, inventory reservations/expiry, delivery/shipping/tax rules and complete Stripe test checkout |
| 5. Orders/payouts/commission/reserves — partial | Order snapshots, seller allocations, settings and accounting records/screens | Connect onboarding, charge/transfer/payout reconciliation, actual reserves/releases and listing-fee collection |
| 6. Refunds/appeals — partial | Questionnaire, private evidence, seller response, human decisions and appeals | Real provider refunds, seller balance/transfer adjustments, retries and agreed appeal rules |
| 7. Administration — partial overall | Dashboard, moderation, audit, settings and review workflows are built | Live admin setup and end-to-end integration with real payments/refunds/payouts when those exist |
| 8. Events — not started | Nothing yet | Simple public events directory |
| 9. Bible — not started, optional | Nothing yet | Decide whether needed; appropriately licensed content and implementation |
| 10. Full verification — partial | 41 local automated checks, lint, types, build and responsive checks passed | Hosted-provider tests, real devices, production security review, backups/restore, monitoring and payment tests |

## Immediate launch scope

The latest agreed release is **real accounts, approved businesses and product discovery, without payments**. Products can link to the brand's own website. Keep the original logo, supplied Deepgrids Sans and **Connect. Discover. Grow.**

- Checkout stays disabled; a payment link is not a multi-seller payment integration.
- Refund decisions are recorded, but no money is refunded.
- No fake products, sellers or demonstration accounts should be inserted in production.
- The eventual app domain is **app.holyhub.co.uk**. Leave root/www and existing email DNS alone.
- A public GPT Site was requested as an interim host, but a fully functional publication is still blocked as described below. There is no new public marketplace URL to share yet.

## What is blocking a functional public link

### 1. Real Supabase project setup

The previously configured project, `mgzsxzixobyfdlutxtgs`, returned missing-table/readiness failures. Having migration files in Git does not mean that they have run in Supabase. Its signup/confirmation settings were enabled, but actual email delivery was not verified.

In your Supabase dashboard, select the intended project. Your developer should first use **SQL Editor** to run [inspect-existing.sql](supabase/ops/inspect-existing.sql), then compare the schema and agree a backup/migration plan. Do not reset it or run the initial migration over conflicting existing tables.

If you choose a confirmed fresh marketplace project, run the seven SQL files in [supabase/migrations](supabase/migrations) once, in filename order, 001 through 007. Never run files from tests/fixtures there. The detailed checklist is in PRODUCTION_LAUNCH.md.

Grant your developer appropriate project access by invitation. Share the selected project URL and its **publishable** key through your deployment setup; never put a service-role key into a NEXT_PUBLIC variable or send passwords/secrets in chat.

### 2. Authentication email and administrator

In Supabase Authentication, configure the approved site/callback URLs, keep email confirmation and secure email change enabled, and configure a verified custom SMTP sender. Put SMTP credentials directly into the service's private settings.

After the real app is connected, create and confirm your own owner account. Your developer then uses [bootstrap-admin.sql](supabase/ops/bootstrap-admin.sql), replacing its placeholder with that confirmed account's Auth user UUID. It refuses unverified users. Never expose a public “make me admin” option.

Test signup, password recovery and email change with real owner-controlled inboxes, including opening a link on a different device. Authentication messages are separate from marketplace notification emails; review notifications currently appear in the account only.

### 3. Hosting the existing application

The existing app is **Next.js 16 on Node 24**, configured for Vercel. GPT Sites runs Cloudflare Workers, so uploading the current Next build is not sufficient. A faithful compatible server build still needs to be implemented and tested if GPT Sites is retained. In particular, native Sharp image validation/re-encoding cannot simply be assumed compatible with that runtime.

Do not replace Supabase security with a demo adapter, expose localhost, disable upload validation, or swap the requested account system for ChatGPT sign-in just to obtain a URL. A static copy cannot provide the requested real accounts/listings and was not approved as a substitute.

For the existing Vercel deployment path, import the reviewed branch, select Node 24 and configure [.env.production.example](.env.production.example) through project environment settings. Vercel already has its build configuration in [vercel.json](vercel.json). Choosing that alternative host instead of the currently requested GPT Site should be agreed with the owner.

## Business decisions only Alea should make

Confirmed prices remain **10 free listings, 20p for each additional listing, 5% commission**. Do not change these silently.

- Does the free allowance count lifetime-created, first-published or currently active products? The implementation currently offers lifetime-created or currently-active modes; the choice is not set for production.
- Is 20p one-off or recurring, and what happens after archiving/republication?
- Exact reserve percentages and holding periods, rather than selecting a number from the suggested ranges without agreement.
- Shipping coverage/rates, tax treatment, appeal window/limits and responsibility for payment/refund/dispute costs.
- The operator identity, privacy/terms, retention rules and who reviews lister applications.

These decisions and the missing financial integration prevent calling the complete original ten-stage specification finished. They do not justify exposing an unsafe demo while the non-payment launch is prepared.

## Commands for your developer

```sh
git clone --branch codex/full-marketplace-mvp https://github.com/officialholyhub-star/holyhub-mvp.git
cd holyhub-mvp
npm ci
npm run demo
```

Use Node 24. The preview is at http://127.0.0.1:3100 and starts empty. No real emails/payments; no real personal information; data resets on restart. Use README's separate real-development instructions when Supabase is ready.

Before inviting the public, complete the checklist in PRODUCTION_LAUNCH.md: a real user confirms email, submits a business, receives admin approval, uploads a product and is discovered while signed out; the data and image survive a redeployment; another user cannot edit them. Run `npm run check:production`; a successful build alone is not launch verification.

## Source ownership and next step

All source, tests, database migrations, fonts/licence, original logo and handoff documents are on the review branch. Local credentials, customer data, installed packages and generated build files are not uploaded. No code was merged over main automatically.

Your next developer should begin with the **hosted database inspection and authentication setup**, then finish the selected host's compatible deployment and real-user checks. Payment development comes afterward. Use account invitations for access; no shared passwords are required.
