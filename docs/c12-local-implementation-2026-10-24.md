# C12 local implementation — founder review

Implemented locally only. Existing uncommitted C9/C11/lister/legal/payment work is preserved. No remote Supabase migration, Stripe financial action, Netlify action, secret modification, commit, push, merge or deployment occurred. No production build was run. No project dependencies or lockfiles were changed. The required Supabase CLI migration generator was run through temporary `npx` tooling.

## Exact files changed/created for C12

- `app/checkout/actions.ts` — Require a supported server-validated delivery address, reject duplicate address/basket/consent fields, snapshot it, and remove Stripe shipping collection; preserve seller readiness and commission logic.
- `app/checkout/success/page.tsx` — Let the database select the trusted address rather than Stripe shipping details.
- `app/api/stripe/webhook/route.ts` — Use database-owned delivery snapshot; preserve existing C11 financial webhook dispatch unchanged.
- `components/basket-view.tsx` — Address inputs, fixed GB country display, NI explanation, blocked checkout and request route.
- `lib/delivery-territory.ts` — Shared postcode format/area validation and strict server address-field parsing.
- `app/shipping/northern-ireland/page.tsx` — Authenticated demand-request route; viewing it performs no writes.
- `app/shipping/northern-ireland/actions.ts` — Server-verified product/seller demand, deduplication and explicit optional email opt-in.
- `components/ni-shipping-interest.tsx` — Simple broad-district and optional notification form using current basket.
- `supabase/migrations/20261024073605_c12_delivery_territory.sql` — Forward-only local migration: immutable checkout address, server-only NI demand and trusted order creation.
- `tests/c12-delivery.test.mjs` — Territory, forged/duplicate input, privacy, opt-in and browsing/request tests.
- `tests/c11-database.test.mjs` — Preserve legacy regression phases; append real SQL C12 migration/security/order/financial checks.
- `tests/checkout-activation.test.mjs` — Supply the newly required address while retaining readiness/identity gate assertions.
- `tests/order-delivery-export.test.mjs` — Update address-source expectations while retaining customer/seller export privacy tests.
- `docs/c12-local-implementation-2026-10-24.md` — Implementation, exact checks, review limits and current working-tree/disk report.

## Delivery and trusted address flow

`startCheckout` rejects BT postcodes before constructing Stripe or creating its session. Supported format alone is insufficient: a geographic England/Scotland/Wales postcode-area allowlist also rejects Crown Dependencies, military/other non-supported areas and invented areas. The postcode is normalized on the server. Duplicate postcode, country, basket and consent fields cannot use first-value parsing to bypass validation. Recipient, street and town/city are bounded and validated; country is fixed to GB.

HolyHub collects the address in the basket. The normalized address is inserted into the server-owned `checkout_sessions.delivery_address` before the payment URL is returned. Stripe shipping-address collection is removed. The existing schema requires Stripe's session ID, so its session is created first; the browser receives its payment URL only after the address, seller and item snapshots are successfully persisted. Existing failure handling expires the mocked/unexposed session if snapshot preparation fails.

Both webhook and checkout-success paths pass an empty compatibility address argument to `process_checkout_payment`. The database ignores that argument as an address source and uses the locked, immutable HolyHub checkout snapshot. Database validation repeats territory/address checks. C11 pricing, item/seller validation, inventory, order idempotency and payment-ledger triggers remain in place. The updated RPC uses invoker security with service-role-only execution; no new definer shortcut or public write access was added.

Existing checkouts/orders are not backfilled or rewritten. Already-created paid orders retain their original addresses on replay. A legacy unpaid/unreconciled session with no trusted HolyHub snapshot cannot create a new order; it fails closed for operator review. No old Stripe session was changed by this work.

## NI demand data and privacy

The explicit Request Northern Ireland shipping action records only:

- The authenticated active account ID and server/database request timestamp.
- Broad postcode district such as BT7, never the full postcode/address.
- Authoritative product IDs/names, quantities/options, seller IDs and brand names re-read from the catalogue.
- A deterministic product-selection hash for duplicate suppression.
- Notification email only when the user explicitly checks the optional notification box.

Client-provided seller/product labels, account ID and address fields are not forwarded to storage. The NI table has no address columns, rejects unexpected demand JSON keys, has RLS enabled and permits writes/reads only through the server service role. An account/district/product-selection uniqueness constraint prevents repeat clicks from inflating the same demand. Viewing the message or request page performs no demand write. The route explicitly says it does not enable delivery or place an order.

## Verification and exact results

- Full local database suite: `HOLYHUB_C11_LOCAL_TEST=1 node --test tests/c11-database.test.mjs` — **102 passed, 0 failed**. Used a newly created, network-isolated disposable PostgreSQL 17 container; automatically removed afterward. This includes legacy C9/C11/A113/A138 checks and C12 address, migration preservation, territory, service-role, privacy, idempotency and shared-fee checks.
- Affected regressions: `node --test tests/c12-delivery.test.mjs tests/checkout-activation.test.mjs tests/order-delivery-export.test.mjs tests/webhook-payment.test.mjs tests/c11-worker.test.mjs tests/order-updates.test.mjs tests/checkout-pricing.test.mjs tests/checkout-origin.test.mjs` — **133 passed, 0 failed**. All provider access mocked.
- Success-page regressions: `node --test --test-name-pattern='payment presentation|paid success-page' tests/friendly-errors.test.mjs` — **2 passed, 0 failed**.
- Initial broader selection including all friendly-errors tests — **97 passed, 1 failed (98 total)**. The unrelated existing failure is `failed storefront load cannot render an editable settings form`: its fixture calls the untouched `StorefrontPage()` without required `searchParams`. This fixture and storefront implementation were left unchanged.
- `npx tsc --noEmit --incremental false` — passed.
- Targeted ESLint over the four modified runtime files, four new runtime files, and four affected test files — passed.
- `git diff --check` — passed.
- Hash comparison confirmed unrelated pre-existing tracked edits were untouched. Exact existing seller-readiness, per-seller commission and C11 financial-webhook blocks were also checked against the pre-task working-tree copies.

## Review limits

- Postcode validation enforces format and supported territory areas; it does not verify that a complete postcode/address is currently assigned or physically deliverable. No external address service or new personal-data processor was added. ONS describes postcode structure and the limitations of geographical inference: https://www.ons.gov.uk/methodology/geography/ukgeographies/postalgeography
- Legacy sessions missing a trusted snapshot require review before any future rollout; no historical addresses are guessed or rewritten.
- The unrelated storefront-fixture failure above remains. No C12-focused test or static check failed.

## Current working tree

The following includes all preserved pre-existing work as well as C12 changes. It is not a list of only this task's edits.

```text
 M app/admin/listers/page.tsx
 M app/admin/orders/page.tsx
 M app/admin/page.tsx
 M app/api/stripe/webhook/route.ts
 M app/checkout/actions.ts
 M app/checkout/success/page.tsx
 M app/lister-terms/page.tsx
 M app/lister/apply/actions.ts
 M app/lister/legal-details/page.tsx
 M app/lister/onboarding/page.tsx
 M app/lister/orders/actions.ts
 M app/lister/page.tsx
 M app/lister/products/page.tsx
 M app/lister/storefront/page.tsx
 M app/lister/terms/actions.ts
 M app/lister/terms/page.tsx
 M app/returns/page.tsx
 M app/terms/page.tsx
 M components/basket-view.tsx
 M components/listing-stage.tsx
 M lib/admin-listers.ts
 M lib/checkout-pricing.ts
 M next-env.d.ts
 M tests/dispatch-proposal.test.mjs
 M tests/order-delivery-export.test.mjs
 M tests/order-updates.test.mjs
 M tests/progress-dashboard.test.mjs
?? app/admin/payments/
?? app/shipping/northern-ireland/
?? components/lister-activation.tsx
?? components/ni-shipping-interest.tsx
?? docs/a138-local-implementation-2026-10-23.md
?? docs/c11-integration-preflight-2026-10-19.md
?? docs/c11-local-implementation-2026-10-19.md
?? docs/c11-preflight-blocker-2026-10-19.md
?? docs/c12-local-implementation-2026-10-24.md
?? docs/customer-onboarding-2026-10-14.md
?? docs/customer-welcome-fix-2026-10-14.md
?? docs/screenshots/
?? lib/delivery-territory.ts
?? lib/lister-activation.ts
?? lib/payment-operations.ts
?? supabase/migrations/20261019105706_c11_guarded_payments.sql
?? supabase/migrations/20261020112737_a110_c11_rpc_execute_permissions.sql
?? supabase/migrations/20261020195527_a113_holyhub_processing_fee_credits.sql
?? supabase/migrations/20261022162816_bind_lister_terms_acceptance.sql
?? supabase/migrations/20261023144733_a138_processing_fee_responsibility.sql
?? supabase/migrations/20261024073605_c12_delivery_territory.sql
?? tests/c11-database.test.mjs
?? tests/c11-worker.test.mjs
?? tests/c12-delivery.test.mjs
?? tests/checkout-activation.test.mjs
?? tests/lister-activation.test.mjs
?? tests/lister-terms-acceptance.test.mjs
?? tests/lister-terms-database.test.mjs
```

## Current disk usage

```text
Filesystem      Size  Used Avail Use% Mounted on
overlay          32G   26G  3.8G  88% /
```
