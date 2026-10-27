# C11 — local implementation and validation, 19 October 2026

**Status: local implementation prepared; not approved for launch, deployment, or shared-stage migration.** No commit, push, merge, deployment, live configuration change, or shared-database write was performed. This report is based on a fresh inspection of the updated checkout, not the earlier blocker report.

## 1. Exact files changed by this execution

- `app/admin/orders/page.tsx`
- `app/admin/payments/actions.ts` — new
- `app/admin/payments/page.tsx` — new
- `app/api/stripe/webhook/route.ts`
- `app/checkout/actions.ts`
- `app/lister/orders/actions.ts`
- `app/lister-terms/page.tsx`
- `app/terms/page.tsx`
- `app/returns/page.tsx`
- `lib/checkout-pricing.ts`
- `lib/payment-operations.ts` — new
- `supabase/migrations/20261019105706_c11_guarded_payments.sql` — new
- `tests/c11-database.test.mjs` — new
- `tests/c11-worker.test.mjs` — new
- `tests/order-updates.test.mjs`
- `docs/c11-local-implementation-2026-10-19.md` — this new report

Branch and origin tracking reference both point to `ecebccbab4f69c3d75099b92263843e2f94bfd1a` on `alea/stage4-payments`. Existing unrelated edits/untracked work were preserved: `next-env.d.ts`, `tests/dispatch-proposal.test.mjs`, the earlier untracked C11 blocker report, onboarding/welcome-fix reports, and screenshots. Build-generated changes to originally clean `tsconfig.tsbuildinfo` are excluded from the implementation.

## 2. New migration

`20261019105706_c11_guarded_payments.sql`, generated using Supabase CLI `migration new` and edited locally. It is forward/additive: new financial tables, views, guarded functions/triggers, and a new inactive draft Terms version. It replaces the payment RPC in a new migration to reconcile seller-specific commission rounding while retaining its signature and C6/C9 integrations. No historical migration file was edited.

All new financial tables have RLS enabled and server-only privileges. Ordinary customers/listers cannot write financial amounts, debts, provider IDs, or acceptance evidence. The authenticated cancellation RPC checks the actual active owning lister, locks the seller/order, and queues only that seller's cancellation refund. Trigger functions with elevated privileges are private/revoked; the public cancellation wrapper explicitly checks actor ownership and role.

## 3. Architecture implemented

- One platform Checkout payment for a multi-seller basket; Stripe Connect **separate charges and transfers**. No destination charge or payment per seller.
- Durable platform payment, verified PaymentIntent/charge, seller allocations, fee snapshots, operation queue, refund lines, reversals, debts, recoveries, webhook state, and reconciliation holds.
- 5% commission on each seller's product value, never delivery. Checkout and payment RPC use the sum of independently rounded seller commissions. Split refunds use cumulative rounding so commission is not credited twice.
- Old in-flight basket-rounding snapshots still record valid paid orders. Any legacy penny mismatch is held for reconciliation; original historical amounts are not silently rewritten.
- Transfers reserve exactly one operation per seller allocation, require that seller's delivered state/date, actual charge/fee evidence, and a verified connected-account mapping. Payment/dispatch alone cannot release proceeds. Delivery corrections after reservation require financial review.
- Pre-transfer refunds reserve only the affected items/delivery and reduce held proceeds. An unattempted queued transfer is reduced before its provider call; its prior debt reservations are released with an audit trail.
- Post-transfer refunds reach the customer before reversal/recovery. Reversal amount is bounded by that seller's unreversed transfer. A definitive insufficient-funds refusal retains the customer refund and creates/verifies the same seller's reimbursement debt. Processing-fee shortfalls follow the existing seller-fee allocation policy.
- Debt records retain original amounts/reasons, source refund and allocation, recovery events, verified shortfall, outstanding balance, and resolution time. Restricted foreign keys prevent seller exit/deletion from silently erasing them.
- Future-proceeds recovery reserves and applies only the same seller's verified balance, with uniqueness and amount caps. **It is disabled until a separately reviewed Terms version is explicitly designated in `payment_policy.recovery_terms_version` and genuinely accepted by that seller.** Older acceptance is not inferred to cover new reimbursement wording.
- Durable operation UUIDs form Stripe idempotency keys. Database leases serialize retries. After 23 hours, an uncertain create is held rather than blindly repeated after Stripe's retention window. Provider metadata and stored IDs support reconciliation after lost database acknowledgements.
- Financial webhooks persist event state, fetch current provider state, and settle operations idempotently. Unknown financial events/external reversal discrepancies create attention/holds. Existing Checkout/webhook and success-page payment reconciliation remain in place.
- Stock restoration is explicit, quantity-bounded, tied to the original decrement, and applied once after successful refund. Faulty/damaged returns default to no restoration. Apparel updates the purchased variant and product aggregate. Inventory failures are recorded separately so a paid customer refund is not lost. Free-item cancellations use a zero-money operation without a Stripe zero-value refund.
- `/admin/payments` provides verified account mapping, item-level refund requests, operator-driven processing/reconciliation, weekly metrics, debt and operation records. Admin orders link to the affected seller portion. No cron or automatic production worker was installed.

## 4. Tests added or extended

`tests/c11-database.test.mjs` starts its own fresh network-isolated PostgreSQL 17 container, replays every migration, exercises the actual SQL functions/roles/concurrency, and removes only its own container. Its scenarios cover the requested multi-seller/commission/delivery, independent completion, partial/full seller refunds, pre/post-transfer recovery, failure/shortfall/debt, same-seller future proceeds, seller exit, no cross/over/double recovery, duplicate requests/leases/settlement, base/variant/faulty stock, reconciliation and C9 acceptance matrix. Additional cases cover queued-transfer refunds, missing inventory, delivery corrections, external adjustment holds, odd-penny commission, legacy in-flight checkout, free items, and an observed two-connection lock wait proving a transfer claim re-reads a refund committed while it waited.

`tests/c11-worker.test.mjs` exercises the actual worker with isolated provider/database doubles: separate charge/transfer parameters, stable keys, pending refunds, insufficient balance, ambiguous outcomes, database failure after provider success, expiry holds, mismatched evidence, duplicate/out-of-order webhooks, provider lookup without another create, zero-money operations, external reversal holds, and admin authorization.

`tests/order-updates.test.mjs` now verifies cancellation invokes the guarded refund RPC and records the reason instead of directly updating status. Its other fulfilment protections remain tested. No unrelated failing test was changed.

Provider doubles do not establish real Stripe behavior; see sections 15–16.

## 5. Checks actually run

Final results from the completed verification pass follow. Local log files are under `/tmp/holyhub-c11-*`.

- C11 real-database tests: **34 passed, 0 failed, 0 skipped**. Includes both complete migration replay orders and a forced lock-wait race test. Command: `HOLYHUB_C11_LOCAL_TEST=1 node --test tests/c11-database.test.mjs`.
- Full default suite: **305 tests: 264 passed, 0 failed, 41 skipped**. Command: `node --test tests/*.test.mjs`. Skips are 34 opt-in C11 database cases, four older database parent tests, and three inactive dispatch-proposal integrations. The database suites were separately enabled and passed; the three inactive dispatch-proposal integrations remain unverified.
- Existing real-Postgres payment suite: **19 passed, 0 failed**, including 15 integrity subchecks and duplicate/oversell/out-of-order concurrency checks.
- Lint: **passed**, no errors or warnings in the latest run.
- Production build: **passed**, including Next.js TypeScript checking and page generation.
- Separate TypeScript check with incremental output disabled: **passed** before the final provider-reconciliation additions; the later production build type-checks those additions too.
- `git diff --check`: **passed**.

Earlier failures were corrected rather than hidden: a local-container readiness race, an ambiguous apparel SQL variable, test module-class/VM boundary assertions, and cancellation test doubles that needed to exercise the new RPC. No remaining test failure is intentionally suppressed.

## 6. Migration provenance and replay

Fresh checkout contains all seven previously missing migrations. Read-only stage migration statements were compared with current repository SQL. These nine match after comments/whitespace normalization:

| Repository file | Recorded stage version |
| --- | --- |
| `025_stripe_fee_payout_breakdown.sql` | `20261007141642` |
| `20261009151400_lister_approval_role_permissions.sql` | `20261009211224` |
| `026_seller_legal_identity.sql` | `20261017202221` |
| `20261017200000_c6_durable_order_confirmation.sql` | `20261017202301` |
| `20261017200500_c6_dispatch_visibility_gate.sql` | `20261017202315` |
| `20261017201000_c6_notification_worker_primitives.sql` | `20261017202338` |
| `20261017204000_c9_lister_terms_acceptance_gate.sql` | `20261017203353` |
| `20261018090000_flexible_dispatch_working_days.sql` | `20261018172124` |
| `20261018010000_audit_readiness_hardening.sql` | `20261018203559` |

The 025 concern is resolved for this source baseline: matching SQL, unchanged historical source, and successful replay. The timestamp/name mapping still matters operationally: **do not use an indiscriminate migration push or rewrite applied history to make numbers match.**

The 33 existing repository migrations replayed successfully before implementation. The database suite then replayed all 34 files, including C11, from synthetic minimal Supabase auth/storage prerequisites. It also replayed them in mapped stage order, including the reversed audit/flexible-dispatch chronology, and compared all public/private function definitions: identical. Both replays succeeded.

These are real PostgreSQL tests with minimal auth/storage shims, not a complete hosted Supabase Auth/PostgREST stack or a production-data rehearsal. No stage/production migration was applied. Read-only connected checks inspected migration/schema/Terms-version metadata; no customer records or secrets were requested.

## 7. Stripe and Supabase actions still required

No external action is authorized or performed by this report.

Before a separately authorized integration run, prepare an isolated test environment containing the reconciled baseline and this exact additive C11 migration. Review the migration/history mapping first; do not replay old numeric files against shared stage. Confirm server-only table/view/function access through real Supabase REST and real authenticated roles.

Use Stripe **test mode** with a Connect-enabled platform and two correctly associated seller accounts whose transfers capability is active. An admin must verify each seller/account identity and save the mapping through the new page; no account is guessed or created by C11. Keep the platform's existing single Checkout payment model.

Deliver the existing Checkout/charge events plus `refund.created`, `refund.updated`, `refund.failed`, `transfer.created`, `transfer.updated`, and `transfer.reversed` to the signed webhook in that isolated environment. Verify the endpoint secret privately. Ensure platform test funds are available for due customer refunds independently of seller balances. Test actual reversal refusal and pending refund behavior.

After professional legal approval, prepare a separate reviewed action to publish an immutable Terms version/hash, activate it through C9, designate that version for recovery, and obtain real seller acceptance. **C11's migration only inserts an inactive draft; it does none of those activation/acceptance steps.**

No production/stage migration, Stripe account configuration, webhook subscription change, live bank funding, deployment, or Terms activation should be inferred from local test success.

## 8. Remaining risks and operating limits

- Real Stripe Connect, balances/refusal codes, signed deliveries, hosted Supabase REST/auth/grants, and full browser journeys still need isolated integration testing.
- Processing is currently an explicit admin action. Run it again to reconcile pending operations and newly queued reversals; this is not a background scheduler. Agree the operational cadence before launch so due refunds are processed promptly.
- Unknown/expired operations, external adjustments, historical penny mismatches, invalid inventory, and seller accounts without transfer capability remain held/flagged for verified review. No blind reset, replacement transfer, or assumption that “not found” proves no money moved is provided.
- Stripe can leave a refund pending if platform funds are unavailable. C11 does not top up a bank balance automatically. HolyHub must arrange the funds required for properly due refunds.
- Debt accounting waits for actual fee evidence or an uncertain transfer to reconcile. Customer refund creation does not wait for a seller reversal. Pending accounting/stock issues require monitoring rather than treating debt/stock figures as final.
- Weekly metrics are London-week groupings in pence; the admin page is a small operational tool, not a complete accounting or chargeback product. Broad dispute automation and offline debt-collection workflows are outside this implementation.
- No legal compliance or launch-readiness certification is made.

## 9–14. Legal and acceptance review

**Exactly three legal pages changed:**

| File | Wording changed |
| --- | --- |
| `app/terms/page.tsx` | Added a pre-launch/professional-review warning; replaced generic payment/reserve wording with one multi-seller Stripe payment and separate seller transfers after each seller's completion; added affected-seller/item refunds, product commission credits, no delivery commission credit, and preservation of due customer refunds/statutory rights. |
| `app/lister-terms/page.tsx` | Added the single-payment/separate-allocation architecture in section 6, and pre-transfer held-allocation reduction versus post-transfer reversal/recovery and no cross-seller funding in section 8. |
| `app/returns/page.tsx` | Added affected-item/seller/delivery partial-refund and internal-settlement protections; clarified no automatic restocking of faulty/damaged returns; replaced obsolete “until in-app workflow is launched” wording with the actual support-reviewed process. Existing statutory deadlines/exceptions were not rewritten. |

`app/lister/terms/actions.ts` and `app/lister/terms/page.tsx` were reviewed and **not changed**. Their real, version/hash-based acceptance flow and fail-closed professional-review gate remain. The new migration inserts draft `2026-10-19-c11-prelaunch-v2`; it does not retire, activate or alter an accepted version, insert acceptance, or designate a recovery contract. Read-only stage inspection found only the existing inactive v1 draft at review time.

Already-correct wording left unchanged includes Lister Terms' 5% product-only commission, delivery exclusion, seller processing-fee responsibility, no blanket 15%/45-day reserve, independent delivered-only transfer timing, proportional commission credit, delivery-only treatment, verified responsibility, HolyHub advances, same-seller reimbursement debt, no double/over/cross-seller recovery, seller exit liabilities, and professional legal review. Existing listing fees/slots and unrelated customer rights/returns content were preserved.

**Founder decisions:** designate the professionally approved binding version and operational processing/reconciliation owner/cadence. If legacy penny mismatches exist, approve an auditable adjustment approach before their transfers; do not silently change historical snapshots. No new general reserve, debt interest, penalty or fee policy was invented.

**Professional legal review remains required:** final customer/lister/returns drafts, seller responsibility and processing-cost treatment, debt and future-proceeds offsets, exit/retention obligations, customer rights, version publication and binding acceptance. Technical tests cannot establish contractual enforceability. This remains a launch gate.

## 15. Alea's manual app test, step by step

Do these only after a maintainer has prepared the **separately authorized isolated test app/database**. The current shared stage has not received C11. Use test buyers/sellers and Stripe test payments only.

1. Ask the maintainer to provide the test app link, two ready test sellers, their test connected-account references, and an admin login. Have the maintainer prepare a reviewed **synthetic test Terms version** and genuine test-seller acceptance; do not activate real launch terms just to test.
2. Sign in as admin. Open `/admin/payments`. For each seller, enter that seller's user reference and the matching test Stripe account reference under “Verify seller payout account”. Click “Verify and save account”. Have the maintainer confirm ownership; do not swap A and B.
3. As a buyer, put one product from seller A and one from seller B in the basket, including delivery charges. Pay once with a Stripe test card. Confirm one customer payment and one order with two seller portions.
4. As admin, click “Process and reconcile payments”. Check the recorded product/delivery totals and commission. For example, £20 product value has £1 commission; a £2 delivery charge adds no commission. Neither seller should have a transfer just because payment succeeded.
5. As seller A, prepare and dispatch A's portion. Process payments again: A must still have no transfer. Mark A's portion delivered/completed and process again. Only A should receive an eligible transfer. B must remain held.
6. Refresh and click processing again. The same A allocation must not produce another transfer. Then complete B's own portion and process again; B gets its own transfer.
7. Make a fresh two-seller test purchase. Before delivery, cancel A's unsent portion through its existing confirmations and reason. Check the confirmation says the refund is queued, not already paid. Process payments. Confirm the refund covers A only, B is unaffected, and the cancelled sellable stock is restored once.
8. Make another test purchase. In admin orders choose “Review payment or refund for this seller portion”. Enter a unique support case reference. Enter the affected product refund in pounds and the delivery refund, if any. Leave all other item amounts at zero. Verify the evidence, responsibility and stock decision; tick the acknowledgement and queue the refund.
9. Process payments and inspect the operation's actual status/provider ID. Repeat the same case submission with the same case reference and amounts: no second refund should appear. Do not use a fresh case reference for a retry.
10. Check a product-only partial refund credits 5% of the refunded product value. Check a delivery-only refund credits zero commission. Confirm B's values never change because A was refunded.
11. For a faulty/damaged return, leave “Verified sellable units to restore” at zero. Confirm stock does not increase. On a separate verified sellable return, enter the units to restore and check stock increases only once after refund success. For apparel, check the correct size and total stock.
12. Refund an A portion after its transfer. Process once for the customer refund and again for the newly queued reversal. Have the maintainer check that the refund and reversal IDs correspond to A's original payment/transfer and the correct amounts.
13. With the maintainer, arrange a Stripe test seller balance/reversal refusal. Confirm the customer refund is still requested promptly, the failed reversal is recorded, and only A has the verified outstanding debt. Ensure HolyHub has the platform test funds to complete the refund.
14. Have the maintainer designate only the synthetic reviewed recovery version and obtain A's actual test acceptance. Make a later sale for A and complete it. Confirm A's debt recovery is capped at the verified balance. Complete a B sale and confirm none of B's proceeds pays A's debt. Re-run processing and confirm no duplicate recovery. Without the designated accepted version, automatic offsets must remain disabled.
15. Close/suspend the test debtor through an approved test process or have the maintainer simulate exit. Confirm debt remains recorded even with no future sales. Do not delete real accounts to test this.
16. Review weekly refunds, funded shortfalls, outstanding debt, recovery time and unresolved reconciliation items. An error/unavailable state must not be treated as a zero balance. Have the maintainer investigate any `attention`, pending accounting or inventory issue.
17. Have the maintainer replay a signed financial webhook and simulate a lost database acknowledgement. Check IDs/balances/stock stay unchanged on the retry. Also check a stale/out-of-order event cannot undo a successful refund.
18. As a customer and ordinary lister, try `/admin/payments`: access must be denied. Check the existing Lister Terms page cannot accept an unactivated draft, and repeated legitimate acceptance preserves the original evidence.

## 16. Tests that require real test services

Steps 2–14 and 17 require Stripe test mode for provider behavior, balances and signed events. Steps 1–18 need an isolated Supabase-backed app to validate real REST/JWT/RLS and browser flows. Local SQL and provider doubles cover invariants and failures separately; they do not replace that integrated rehearsal. A maintainer must arrange the insufficient-balance, provider/DB outage and webhook replay cases. No such real-provider mutations were attempted here.

## 17. Recommended next safe action

Review this local diff and migration, then separately authorize a complete isolated Stripe-test/Supabase integration rehearsal and founder checklist. Keep shared stage/production and Terms activation untouched until that review and the professional legal gate are cleared. C11 is not claimed complete merely because local code and automated tests exist.

Technical references consulted: [Stripe separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers), [transfer reversals](https://docs.stripe.com/api/transfer_reversals/create), [idempotency retention](https://docs.stripe.com/api/idempotent_requests), installed Next.js route-handler guidance, and the [Supabase changelog](https://supabase.com/changelog).
