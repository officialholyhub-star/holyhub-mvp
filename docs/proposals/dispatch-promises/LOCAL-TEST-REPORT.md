# Isolated dispatch validation — 10 October 2026

**Feature status: PENDING FINAL INTEGRATION VERIFICATION.** On user instruction, do not apply the migration or make further database changes. Preserve the SQL proposal, inactive integration patch, staged application sources and local/offline test artifacts for future review. Dispatch promises are excluded from the current launch browser checks.

**Overall: FAIL to satisfy full acceptance coverage. Do not approve production application yet.** No observed failure in the executed proposal SQL checks. Unverified integration coverage prevents a full PASS.

## Isolation

Exact proposed SQL executed ONLY in `holyhub-dispatch-isolated`, cached `postgres:17`, network `none`, no ports, no bind mounts or credentials, data in tmpfs. Relevant repository payment/product/fulfilment migrations bootstrapped with a minimal local auth.users/auth.uid/auth.role shim. Synthetic fixtures only. No connection to real Supabase or Stripe. Existing Supabase service-role BYPASSRLS semantics reproduced locally; authenticated tests explicitly SET ROLE authenticated, not merely JWT claims under postgres.

## Passed

The accompanying results.json records twelve successful checks:

- A historical order created before migration retained its parent data; its seller promises/deadlines stayed NULL.
- Fresh two-lister order copied separate 3-day and 7-day snapshots into the correct seller portions and recorded deadlines.
- Actual owning-lister shop settings update did not modify saved seller orders or deadlines.
- Paid retry preserved seller rows byte-for-byte, did not move deadlines, and did not decrement stock twice.
- Legacy in-flight checkout successfully created an order with unknown timing; enrichment changed zero rows.
- Calendar cases: weekday and weekend starts, London local midnight, spring BST transition, autumn GMT transition, UTC versus New York session timezone, invalid bounds and infinite timestamp rejection.
- Real customer/lister roles: buyer sees both seller portions, seller sees own, unrelated user sees none. Snapshot/deadline changes and timing RPC execution denied. Checkout seller snapshot reads denied. Foreign shop update affected zero rows.
- Existing fulfilment update affected only the owning lister's portion.
- Six concurrent order RPCs and six confirmation RPCs produced one parent order, one stock decrement, and exactly two filled seller deadlines.
- A real permission failure in separate post-commit enrichment left paid order, amounts and stock committed, with timing unknown.
- Explicit overdue predicate boundary check excludes unknown, dispatched and delivered rows and includes pending/packed at the exact deadline. This tests a predicate, not an implemented admin/lister overdue UI.
- Existing SQL payment-integrity regression: all 15 assertions passed.

Additional role probe: actual admin role could read orders. Anonymous timing RPC EXECUTE privilege was false; calendar access failed with permission denied for schema private, as intended. That probe deliberately terminated on the denial; it was not a proposal failure.

Executed monetary/stock fixture: total 7200p, commission 325p, seller product proceeds 6175p, delivery 700p; Book stock 9→7, selected apparel variant 7→4, unselected variant remained 5. Original payment regression tests cover additional monetary validation and rollback conditions. Offline staged/current checkout comparison also preserved exact Stripe request, checkout totals and item payloads.

Selected offline test command completed successfully for dispatch-proposal, webhook-payment, checkout-pricing, checkout-origin and order-updates. The runner reported five passing file entries, zero failures. This does not represent a real Stripe API test.

## Not verified — approval blockers

- Complete staged startCheckout → local Supabase REST API → Stripe confirmation → real webhook route → order end to end. Offline routes used mocked database/provider interfaces; SQL tests separately used real PostgreSQL.
- Executing the unchanged success-page reconciliation and staged webhook against the same complete local Supabase stack. Both call the same seven-argument RPC, and its concurrent execution passed; that is not equivalent to testing both full application paths.
- Hosted Supabase Auth/JWT verification, API schema cache/exposure and target-project default grants/schema drift. The local auth shim establishes database role/RLS behavior, not those gateway guarantees. Real project access was deliberately prohibited and not attempted.
- Real Stripe charge/signature delivery, delayed payments or webhook delivery outages. No Stripe API call or setting change was made.
- Real REST abort/timeout after 1500ms. Helper timeout/error behavior passed offline; actual post-commit permission failure passed in PostgreSQL. Combined route plus actual API timeout remains untested.
- Full acceptance matrix: real single-lister application checkout, three-lister real database checkout with free delivery, edits between capture and payment, forced lock-wait observation, leap-year and 365-day calendar bounds, transaction-DDL rollback rehearsal, invalid confirmation/mismatched-session matrix, and actual operational overdue UI. Do not infer these passed from adjacent checks.

The environment had cached PostgreSQL/PostgREST images, but no complete isolated Supabase Auth stack was established. Per the instruction to stop if full isolated database/integration testing is unavailable, validation stops here rather than substituting mock results for full coverage. No request for production approval is made.

## Files and reproduction

`local-validation/bootstrap.sql.txt` preserves the exact local bootstrap/probe executed, including relevant repository migrations, synthetic historical fixture, exact proposal and initial service-role call. It is NOT a deployable migration. `local-validation/run.mjs` preserves the twelve-check harness with a container-isolation guard; run from repository root only against a freshly bootstrapped dedicated container. `local-validation/results.json` preserves the actual results.

No proposal/application patch was activated or revised. No production database migration, RLS modification or Stripe change occurred. No production build was rerun in this test-only turn; the prior staged build remains documented in SAFETY-REPORT.md. No new application code was changed.
