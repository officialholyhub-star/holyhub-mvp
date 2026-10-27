# A-138 local implementation for founder review

This change implements the approved processing-fee responsibility scope only. A-112 remains paused. Nothing in this work authorizes a shared migration, provider financial execution, deployment, historical backfill, seller debt, or clawback.

## Contract and versioning

New administrative refunds call the seven-argument `request_payment_refund` with explicit integer `p_fee_responsibility_bps` (0–10000). This writes policy version 2 and an immutable share in operation details. The existing boolean and seller refund liability calculation are unchanged. Retry keys include the independent fee share; changing it conflicts. The six-argument endpoint supports exact historical version 0/1 retries only. Seller-initiated cancellation supplies explicit zero fee responsibility, preserving its existing behavior.

Versions 0/1 and the A-113 ledger/payment records remain unchanged. The new migration adds an immutable assessment ledger, immutable provider reimbursement evidence, immutable cash reservation identities and review exceptions. Unattempted reservations may become failed/superseded, with a new operation identity for the adjusted payment; their original amounts, links and request keys remain intact. No attempted reservation is automatically replaced.

## Calculation

For each successfully refunded seller portion, let `F` be its original allocated processing fee, `G` its original product-plus-delivery gross, `R` the refund gross and `B` HolyHub's responsibility in basis points.

- Original proportional entitlement is `F × R / G × B / 10000`.
- Current entitlement for that refund is the lesser of this value and `max(F × R / G − attributed provider reimbursements, 0)`.
- Calculations retain fractional pennies and apply round-half-up cumulatively across the allocation, including varying shares. The difference between cumulative rounded totals assigns each refund's entitlement. Zero gross produces zero.
- The allocation's total payment capacity is additionally limited by the original allocated fee less provider reimbursements and recognized legacy credits. Paid and uncertain/reserved payments consume that capacity.
- Rebate-adjusted cumulative rounding can move one penny between assessments. Original assessment snapshots are not rewritten. Current entitlements and payments are reported separately.

Seller locks serialize recognition, provider evidence, reservation, claim and settlement. Database guards validate evidence and cash links, enforce immutable identities, and prevent privileged direct inserts from bypassing rebate reconciliation. All new tables have RLS and server-only grants; functions use invoker security and empty search paths. The seller-cancellation function retains its existing authenticated, ownership-checked definer boundary.

## Provider evidence and late outcomes

An admin records a verified, refund-attributed provider reimbursement, its canonical unique provider reference, amount, evidence and verifier. Recording evidence does not call Stripe. An identical reference replay returns the original row; conflicting reuse is rejected, including across sellers. Amounts cannot exceed the applicable original refund fee or the seller allocation's total fee.

Before a cash attempt, rebates supersede unattempted version-2 reservations and reserve only the current capped amount. After an attempt or completed payment, evidence creates a review exception; provider outcome reconciliation preserves the original operation. Paid history remains unchanged. No seller debt or recovery operation is created. Historical version-1 unpaid credits affected by rebates are held for review, without rewriting their original records.

## Review limits

Provider evidence entry is explicit; this scope does not add automatic discovery of arbitrary provider balance adjustments. One unique reimbursement reference is attributed to one refund/seller. A provider adjustment spanning multiple refunds or sellers requires an explicitly reviewed allocation workflow; conflicting reuse is rejected rather than guessed. Evidence corrections and resolution of late-paid exceptions also require separate review. No automatic clawback or debt route is supplied.

## Local verification

`tests/c11-database.test.mjs` runs all legacy C11/A-113 regressions first, applies A-138 with historical snapshot comparisons, then exercises version-2 behavior in a newly created, network-isolated disposable PostgreSQL 17 container. No existing database is reused. The misleading mixed-responsibility test now explicitly names separate binary refunds.

The suite also updates two stale legacy test fixtures to the already-present bound terms-acceptance signature and migration ordering; no terms implementation or wording changes are included.

Worker/admin tests use mocks that reject real Stripe/database access. Additional related regressions cover webhook payment handling, order updates, checkout pricing and launch metrics. TypeScript and targeted ESLint checks are run separately. Final counts are reported in the founder-review response.

Verified results:

- Full disposable PostgreSQL C11/A-113/A-138 run: **84 passed, 0 failed**.
- Final focused A-138 run, including canonical provider-reference regression: **31 passed, 0 failed**.
- Mocked C11 worker/admin plus webhook-payment, order-updates, checkout-pricing and launch-metrics suites: **57 passed, 0 failed**.
- `npx tsc --noEmit --incremental false`: passed.
- Targeted ESLint for the two admin files, worker and two C11 test files: passed.
- `git diff --check`: passed. Disposable database containers were removed by the test runner.
