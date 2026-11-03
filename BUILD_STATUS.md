# Full MVP build status

## Public Sites release — 20 September 2026

[HolyHub Marketplace](https://holyhub-marketplace.matthewjeanty6.chatgpt.site) is deployed using the separate `sites/` application. The owner approved replacing an old Deepgrids Site, using Sites D1/R2 and ChatGPT sign-in instead of Supabase. Root/www HolyHub remain unchanged. The Sites release includes persistent accounts, lister applications, human review, product drafts/photos/public discovery, events and moderation. No sample listings are deployed. It intentionally does not contain checkout, payment/commission/refund execution, Bible or community conversations. See [the current handoff](sites/SITES_HANDOFF.md).

Verification: the Sites Worker built and typechecked; application lint passed; 30 local workflow checks plus cross-owner/forged-identity checks passed; phone/tablet/desktop layouts and browser form submission passed. Hosted publication succeeded, and live ChatGPT owner sign-in and administration visibility were verified. Original Next.js checks also passed (40 database/validation, 4 account/discovery browser, 8 marketplace browser checks). The original ten-stage scope has **not** suddenly become ten completed stages: money-related stages remain incomplete and outside this release.

The sections below document the retained Supabase version and its earlier readiness status.

## Real-listing launch pass

Final release safeguard: `build:production` now runs online, read-only service readiness checks before compilation. A missing backend, unsafe configuration, unavailable provider, missing verified admin, unready private image storage or disabled email confirmation stops deployment. Two added gate/failure tests bring the suite to 51 checks. No paid features have been activated and no new dependencies added.

Production target: **app.holyhub.co.uk**, leaving the current website intact. Added an empty-by-default local preview, clearer application-to-product navigation, a direct brand-website path, application notifications, deployment configuration, a public health route, read-only preflight and owner-only SQL setup templates. See PRODUCTION_LAUNCH.md for the full launch requirements and infrastructure.

The current hosted database is not yet verified compatible: missing-table API errors remain. GitHub access is now resolved: the collaboration invitation was accepted and the complete `codex/full-marketplace-mvp` branch uploaded. Browser access still timed out. Nothing has been migrated, deployed, purchased or changed in DNS. This is **not yet a public, production-functional service**. See ALEA_START_HERE.md for the owner handoff and the newly requested GPT Sites hosting constraints.

Built on the repository's working Next.js/Supabase account foundation. The unavailable Codespace checkout code was not copied or assumed to exist. No live database migration, payment, payout, refund, DNS change or production deployment was performed.

The latest finishing pass is explicitly scoped to the current MVP **without payments**. It applies the supplied Deepgrids Sans font locally, retains the original logo, adds clear active navigation and keyboard-accessible product photo selection, and checks compact/mobile layouts. Disabled payment controls remain disabled; failed data reads now surface an error instead of a misleading empty result.

## Ready to exercise locally

Original ten-stage progress: **four built locally (1, 2, 3, 8), five partial (4, 5, 6, 7, 10), one not started (9, optional Bible)**. Local implementation is not production acceptance. This finishing pass completes the simple events directory and adds configurable authentication CAPTCHA support without new dependencies or enabling live payments.

| Area | Implemented |
| --- | --- |
| Accounts | Signup, confirmation, login/logout, recovery, profile/email changes, role guards |
| Listers | Business application, human approval, storefront, editing/re-review |
| Products | Drafts, editing, validated photos, publication, archiving, stock, category and GBP price |
| Discovery | Public business/product pages, search, category and price filters, pagination |
| Events | Public search and detail pages; admin-only draft/edit/publish/archive, recurring-schedule text, organiser links, audit history and stale-write protection; no fake events |
| Basket | Signed-in multi-seller basket, quantity/availability checks, unpaid order preview |
| Orders | Immutable item snapshots, per-seller allocations, commission snapshots, order history and delivery progress |
| Refunds | Questionnaire, private evidence, seller response, human full/partial/rejected decisions, configurable appeals |
| Seller finances | Recorded gross/commission/reserve/refund/transfer figures and fee-due records |
| Administration | Applications, users, sellers, product moderation, order breakdowns, policy settings and audit history |
| Notifications | In-account business review, payment-test and refund updates |
| Security checks | Role/ownership restrictions, file validation, private storage, raw-body signatures and payment-event replay protection |
| Optional auth bot protection | Turnstile widget and token forwarding for signup/login/recovery, with retry/expiry handling; configure the matching provider settings in Supabase before enabling |

## Not complete / intentionally disabled

1. **Checkout and payments:** no Checkout Session creation, stock reservation/decrement, checkout expiration handling, delivery-address capture, shipping/tax calculation or live payment acceptance.
2. **Seller money movement:** no Stripe Connect onboarding, account verification sync, charge allocation transfers, scheduled payouts, reserve releases, reversals or provider dispute handling.
3. **Actual refunds:** the app records an administrator's decision; it does not execute refunds or adjust seller balances through Stripe. The future implementation must reconcile pending/failed/succeeded provider states and prevent duplicate money movement.
4. **Listing-fee collection:** an extra listing can be blocked with a fee-due record, but there is no payment or renewal collection flow. A browser cannot grant its own fee credit.
5. **Email operations:** account messages use Supabase Auth once SMTP is configured; marketplace event emails/Resend, delivery retries and email verification of hosted settings are not connected.
6. **Production setup:** the unknown newer live Supabase schema must be reconciled (or a fresh development project used), migrations reviewed, administrator assigned and production host configured.
7. **Operating policies:** final operator identity, customer/seller terms, shipping, tax treatment, refunds/appeals, retention, backup/restore and abuse controls need owner review and live-environment testing.
8. **Later scope:** Bible/community content, loyalty, subscriptions and advanced analytics have not been added. The events directory is implemented, but automatic recurrence, ticketing and attendee management are not part of this simple directory.

A Stripe Payment Link alone cannot complete a multi-seller integration. A future developer needs appropriately scoped, privately configured Stripe API access and webhook signing secrets, Connect settings and the approved commercial rules. Do not paste passwords or secret keys into chat or Git.

## Owner decisions still needed

- Is the free allowance lifetime-created products (including drafts), first published products, or currently active products? The implementation offers lifetime-created or currently-active; confirm before choosing.
- Is the 20p fee one-off or recurring, and what happens to fees when products are archived/re-published? No renewal policy has been invented.
- Shipping coverage, rates per seller, address handling, digital fulfilment and tax/VAT treatment.
- Reserve percentages and hold periods by seller risk tier.
- Appeal window, maximum appeals and when a reviewed case can be finally closed.
- Which party bears processing costs, refunds, disputes and negative balances.

Production defaults are only the confirmed 10 free listings, 20p additional listing fee and 5% commission. Unconfirmed financial/appeal settings remain unset. Demonstration values in the local seed are not production recommendations.

## Financial integration handoff

Use test mode first. Before enabling checkout, implement server-created, idempotent sessions using trusted prices; reserve stock transactionally with expiry/release; snapshot agreed delivery/tax/commission rules; record the session ID on the order; verify signed events before fulfilment; and reconcile Connect account capabilities. Never rely on a return URL as proof of payment.

Current webhook ingestion is a guarded **test-only boundary**, not a finished payment system. It matches session ID, order, amount and currency; requires recorded reserve settings; rejects live-mode events; and deduplicates verified events. Extend it only alongside the missing reservation, refund, transfer and reconciliation flows and their failure/replay tests.

Database tests and the loopback demo use disposable PostgreSQL-compatible PGlite. They are not a substitute for an end-to-end run against a fresh real Supabase project and Stripe test accounts.

## Source and launch separation

Local branch: codex/full-marketplace-mvp.

The original holyhub.co.uk landing-page project remains untouched. This app is not publicly deployed. See README.md for demo accounts, test commands and the setup sequence.

## Verification completed for this build

- 40 database/validation/configuration checks passed, including an empty database through first approved publication, role policies, fee enforcement, private storage, payment replay protection, events security and production readiness failures.
- Eleven isolated browser journeys passed (three account/business journeys and eight marketplace journeys), including an empty catalogue and new applicant, upload size validation, external brand links, Deepgrids Sans rendering, keyboard photo selection, event curation and CAPTCHA retries.
- CAPTCHA browser tests use a local provider stand-in and enforce forwarding in the isolated auth adapter; they do not prove real Cloudflare/Supabase verification. Hosted testing is required.
- Lint, TypeScript, production build and git whitespace checks passed.
- Production dependency audit reported zero known vulnerabilities at the time of the check; this is not a guarantee against security defects.
- Desktop and phone-width screenshots were inspected; discovery was checked at widths from 320 to 1440 pixels.
- GitHub access was resolved by accepting the matching invitation. The complete review branch is pushed to the repository; main remains unchanged. [Pull request #1](https://github.com/officialholyhub-star/holyhub-mvp/pull/1) contains the source and current GitHub Actions checks. The events/CAPTCHA release 77d20e3 passed GitHub Actions; consult the PR for the latest release-gate commit's result. Neither local nor CI results prove production-provider readiness.
