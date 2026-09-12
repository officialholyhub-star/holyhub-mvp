# Full MVP build status

## Real-listing launch pass

Production target: **app.holyhub.co.uk**, leaving the current website intact. Added an empty-by-default local preview, clearer application-to-product navigation, a direct brand-website path, application notifications, deployment configuration, a public health route, read-only preflight and owner-only SQL setup templates. See PRODUCTION_LAUNCH.md for the full launch requirements and infrastructure.

The current hosted database is not yet compatible: missing-table API errors remain. GitHub write access still returns 403 and browser access timed out. Nothing has been migrated, deployed, purchased or changed in DNS. This is **not yet a public, production-functional service**.

Built on the repository's working Next.js/Supabase account foundation. The unavailable Codespace checkout code was not copied or assumed to exist. No live database migration, payment, payout, refund, DNS change or production deployment was performed.

The latest finishing pass is explicitly scoped to the current MVP **without payments**. It applies the supplied Deepgrids Sans font locally, retains the original logo, adds clear active navigation and keyboard-accessible product photo selection, and checks compact/mobile layouts. Disabled payment controls remain disabled; failed data reads now surface an error instead of a misleading empty result.

## Ready to exercise locally

| Area | Implemented |
| --- | --- |
| Accounts | Signup, confirmation, login/logout, recovery, profile/email changes, role guards |
| Listers | Business application, human approval, storefront, editing/re-review |
| Products | Drafts, editing, validated photos, publication, archiving, stock, category and GBP price |
| Discovery | Public business/product pages, search, category and price filters, pagination |
| Basket | Signed-in multi-seller basket, quantity/availability checks, unpaid order preview |
| Orders | Immutable item snapshots, per-seller allocations, commission snapshots, order history and delivery progress |
| Refunds | Questionnaire, private evidence, seller response, human full/partial/rejected decisions, configurable appeals |
| Seller finances | Recorded gross/commission/reserve/refund/transfer figures and fee-due records |
| Administration | Applications, users, sellers, product moderation, order breakdowns, policy settings and audit history |
| Notifications | In-account business review, payment-test and refund updates |
| Security checks | Role/ownership restrictions, file validation, private storage, raw-body signatures and payment-event replay protection |

## Not complete / intentionally disabled

1. **Checkout and payments:** no Checkout Session creation, stock reservation/decrement, checkout expiration handling, delivery-address capture, shipping/tax calculation or live payment acceptance.
2. **Seller money movement:** no Stripe Connect onboarding, account verification sync, charge allocation transfers, scheduled payouts, reserve releases, reversals or provider dispute handling.
3. **Actual refunds:** the app records an administrator's decision; it does not execute refunds or adjust seller balances through Stripe. The future implementation must reconcile pending/failed/succeeded provider states and prevent duplicate money movement.
4. **Listing-fee collection:** an extra listing can be blocked with a fee-due record, but there is no payment or renewal collection flow. A browser cannot grant its own fee credit.
5. **Email operations:** account messages use Supabase Auth once SMTP is configured; marketplace event emails/Resend, delivery retries and email verification of hosted settings are not connected.
6. **Production setup:** the unknown newer live Supabase schema must be reconciled (or a fresh development project used), migrations reviewed, administrator assigned and production host configured.
7. **Operating policies:** final operator identity, customer/seller terms, shipping, tax treatment, refunds/appeals, retention, backup/restore and abuse controls need owner review and live-environment testing.
8. **Later scope:** dedicated events, Bible/community content, loyalty, subscriptions and advanced analytics have not been added. The build prioritises the marketplace.

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

- 32 database/validation/configuration checks passed, including an empty database through first approved publication, role policies, fee enforcement, private storage and payment replay protection.
- Nine isolated browser journeys passed (three account/business journeys and six marketplace journeys), including an empty catalogue and new applicant, upload size validation, external brand links, Deepgrids Sans rendering and keyboard photo selection.
- Lint, TypeScript, production build and git whitespace checks passed.
- Production dependency audit reported zero known vulnerabilities at the time of the check; this is not a guarantee against security defects.
- Desktop and phone-width screenshots were inspected; discovery was checked at widths from 320 to 1440 pixels.
- GitHub still returned 403 for the connected matthewjeanty account. Changes are saved locally, not pushed to the remote repository.
