# C11 preflight — stopped on baseline/provenance conflict

Date: 19 October 2026. Active human: Alea. C11 is **not implemented or complete**.

The supplied C11 request requires stopping when migration provenance cannot be proven safely or the current architecture materially conflicts with the approved scope. That stop condition was reached before application edits.

## Verified checkout and preservation

- Repository remote: `officialholyhub-star/holyhub-mvp`.
- Branch: `alea/stage4-payments`.
- HEAD: `260a41f1aee0105ab88d71d9dd0180013d114231`.
- Pre-existing changes preserved: `next-env.d.ts`, `tests/dispatch-proposal.test.mjs`, untracked `docs/customer-onboarding-2026-10-14.md`, `docs/customer-welcome-fix-2026-10-14.md`, and `docs/screenshots/`.
- No branch switch, historical migration edit, commit, push, merge, deployment, configuration change, or shared-database mutation.
- Connected Supabase access was limited to project discovery, migration listing, and explicit read-only transactions for migration metadata and schema column metadata. No customer records or credentials were requested.

## Blocking evidence

The connected `holyhub-stage4-test` database has these applied migrations absent from this checkout:

| Version | Name |
| --- | --- |
| 20261017202221 | seller_legal_identity |
| 20261017202301 | c6_durable_order_confirmation |
| 20261017202315 | c6_dispatch_visibility_gate |
| 20261017202338 | c6_notification_worker_primitives |
| 20261017203353 | c9_lister_terms_acceptance_gate |
| 20261018172124 | flexible_dispatch_working_days |
| 20261018203559 | audit_readiness_hardening |

Schema inspection confirms stage has `lister_terms_versions`, `lister_terms_acceptances`, `notification_outbox`, and `notification_attempts`, plus seller legal-identity and dispatch fields absent from the repository migration baseline. `app/lister/terms/` does not exist in this checkout. C11 must preserve and test the actual C9 acceptance gate rather than invent a parallel implementation on this older baseline.

Migration 025 findings:

- Repository file: `supabase/migrations/025_stripe_fee_payout_breakdown.sql`.
- Introduced on this branch in `882afb8`; its Git blob remains `91efaf000cb9372b3c7172036fb0545029be75b0` at HEAD. No historical modification was made.
- Stage records the corresponding migration under timestamp `20261007141642`, name `stripe_fee_payout_breakdown`, rather than repository version `025`.
- A read-only comparison of the recorded statement text with the repository file, ignoring outer whitespace, returned false. This alone does **not** establish a semantic difference; comments, formatting, or other differences remain unexamined. Exact applied-source equivalence is unproven.
- The existing `tests/payment-database.test.mjs` bootstraps a selected migration subset that omits 025. Its normal results cannot establish 025 replay/provenance.
- Other history also uses different stage/repository versions and names. A generic migration push from this checkout is not a verified deployment path.

Do not repair this by renaming/editing applied historical files or resetting stage. The safe next step is to obtain the authoritative C6/C9 and later source history on the required branch, review the applied SQL mapping including 025, and establish a reproducible baseline. Any eventual C11 migration must be new, additive, and ordered after that reconciled baseline. No deployable C11 migration is proposed before that work.

## Local replay performed

Created only a disposable `postgres:17` container named `holyhub-c11-preflight`, with Docker network `none`, no published ports or bind mounts, and data in tmpfs. Used synthetic minimal Supabase auth/storage schema shims, no project credentials or data.

Executed all 26 repository migration files in filename order, each in a transaction with `ON_ERROR_STOP=1`: 001–025, followed by `20261009151400_lister_approval_role_permissions.sql`. **All 26 passed**, including 025.

This proves SQL replay of the repository sequence against that minimal local baseline. It does not prove parity with stage, replay of the seven missing migrations, hosted Supabase behavior, Stripe integration, or C11 financial correctness. The temporary container was removed after inspection.

## Existing payment and fulfilment architecture inspected

- `app/checkout/actions.ts` creates one platform Checkout Session for the basket, with product lines and per-seller delivery lines. Checkout, item, and seller delivery snapshots are saved before redirect. No Connect transfer is created here.
- `lib/checkout-pricing.ts` calculates 5% on product subtotal, excluding delivery. `process_checkout_payment` also calculates commission per seller; aggregate rounding versus the sum of seller commissions needs explicit reconciliation coverage in C11.
- `app/api/stripe/webhook/route.ts` verifies signatures, processes paid/failed/expired Checkout events using the atomic payment RPC, and reconciles processing fees from charge events. `app/checkout/success/page.tsx` is another payment-reconciliation entry point and must remain compatible.
- Migration 023 locks checkout/snapshots/inventory, creates one parent order with seller orders and items, and calls the existing stock routine transactionally. Duplicate payment handling uses checkout locking and order uniqueness.
- Migration 025 allocates Stripe processing fees and records payout calculations; this is not a durable Connect transfer/refund/debt ledger.
- `app/lister/orders/actions.ts` updates the individual seller portion through pending, packed, dispatched, delivered, or cancelled states, with correction support. Cancellation does not issue a Stripe refund. No implemented transfer/reversal path was identified in the inspected payment flow.
- C11 refund/reversal/debt recovery and exactly-once applicable stock restoration remain unimplemented in this checkout. No weekly C11 monitoring was added.

## Requested implementation report

1. **Exact files changed:** only this new report, `docs/c11-preflight-blocker-2026-10-19.md`.
2. **New migrations:** none.
3. **Architecture implemented:** none; preflight stopped on the conflict above.
4. **Tests added:** none.
5. **Checks run:** 26-file disposable PostgreSQL replay passed. Branch/HEAD/status, historical Git blob, connected migration history, and schema metadata inspected. Full tests, lint, build/type checks, and the 24-case C11 suite were not run because implementation stopped; no passing C11 claim is made.
6. **Replay/provenance:** repository replay passes; current stage baseline and applied 025 equivalence remain unproven.
7. **Stripe/Supabase actions still required:** read-only source/history reconciliation first. No stage/production migration or Stripe configuration action is ready to execute. Exact later operational changes must follow a reviewed implementation and test plan; they cannot safely be specified as deployment instructions yet.
8. **Unresolved risk:** building on this baseline could duplicate or regress the existing C6/C9 architecture. All C11 requirements remain launch blockers.
9. **Legal dependency:** use the authoritative C9 version/hash acceptance flow; never create acceptance on a seller's behalf. Professional legal review and founder approval remain launch gates.
10. **Exact Terms/T&Cs files changed:** none.
11. **Wording changed per Terms file:** none, because implementation stopped before legal alignment.
12. **Existing aligned wording left untouched:** Lister Terms section 4 already states 5% product-only commission excluding delivery; Customer Terms preserve statutory rights; Returns preserves statutory rights and honestly describes the in-app refund workflow as not launched. This is a limited inspection, not a full legal approval.
13. **Founder decisions still needed:** establish the authoritative source baseline first; then resolve any policy questions exposed by the actual implementation, including responsibility for unrecoverable Stripe processing fees if not already approved. Do not infer new policy from migration 025.
14. **Professional legal review:** still required for final customer/lister drafts, reimbursement debt, future-proceeds recovery, seller exit liabilities, and the versioned acceptance wording. Current Lister Terms section 6 describes a planned 21-day/30-day post-dispatch payout/reserve policy that conflicts with A-107; section 7's generic recovery wording needs C11 alignment. Customer Terms section 5 also mentions reserves. These were flagged, not rewritten to promise unimplemented behavior.
15. **Alea's manual testing now:** no C11 app test is ready. Follow the steps below to unblock the baseline first.
16. **Later tests needing test services:** real Connect account onboarding, single-payment multi-seller Checkout, signed webhook retries, independently delivered seller transfers, pre/post-transfer refunds, reversals including insufficient balance, and provider/database failure recovery require Stripe test mode and an isolated Supabase test environment containing the reconciled schema. Same-seller debt accounting, idempotency, stock restoration, and concurrency also need local real-database automated tests. No shared-stage mutation was performed in this preflight.
17. **Recommended next safe action:** reconcile the required branch with the authoritative source and applied migration history without discarding local work, then rerun preflight and implement C11. Do not launch or apply migrations based on this report.

## Simple next steps for Alea

1. Ask the maintainer who delivered C6/C9 and the later hardening work for the exact source commit and migration files corresponding to the seven versions listed above.
2. Have that maintainer compare the stage record for `20261007141642` with repository migration 025 and document any differences. Do not click Run on migration SQL or change migration history.
3. Have the reviewed source incorporated on `alea/stage4-payments` while preserving the current uncommitted work. This report does not authorize a merge, commit, push, or deployment.
4. Rerun C11 against that confirmed baseline. Only after implementation is validated should a founder app-testing checklist name actual screens and buttons. Current cancellation must not be treated as proof that a customer was refunded.

The later founder test must walk through a two-seller test basket, verify one customer payment, complete seller A while B stays held, then complete B; test affected-item and seller-only refunds before and after transfer; verify faulty items are not blindly restocked; retry operations and verify no duplicates; verify recovery touches only the debtor seller; and verify new terms require genuine acceptance. Those are future acceptance criteria, not features delivered by this preflight.
