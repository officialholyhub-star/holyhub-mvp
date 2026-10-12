# Dispatch promise v2 — approval packet (NOT APPLIED)

This packet supersedes the JSON-based proposal described in the earlier launch-readiness report. Only proposal documents, staged source files and offline tests were changed. No application route/helper was activated, no patch was applied to the working application, no SQL was run, no migration was applied, no RLS was changed, and no Stripe/Supabase configuration or production data was changed.

## Actual flow traced in this repository

1. `components/basket-view.tsx` submits basket/terms to `startCheckout` in `app/checkout/actions.ts`.
2. The action authenticates the customer, loads approved/published products and stock/variants, loads each lister's saved delivery settings, checks availability and calculates the existing price/commission/delivery totals.
3. It creates a Stripe Checkout Session using the existing line items, one delivery charge per seller, customer email, GB address collection, URLs and metadata. A Stripe Session is NOT a permanent HolyHub order.
4. It inserts `checkout_sessions`, one `checkout_session_sellers` row per lister (including free-delivery sellers), and `checkout_session_items`. These are server-owned checkout records, NOT permanent orders. On a persistence failure it attempts to expire the Stripe Session and uses the existing error path. Customer redirect happens only after these saves succeed.
5. `app/api/stripe/webhook/route.ts` verifies the signed Stripe body, accepts the existing event types, and ignores unpaid completion while waiting for `checkout.session.async_payment_succeeded`. Paid events must have valid GBP totals. It calls the existing seven-argument `process_checkout_payment` RPC.
6. There is a SECOND creator: `app/checkout/success/page.tsx`. For the signed-in user's pending checkout, it retrieves the Session from Stripe, verifies paid status/amount/currency, and calls the SAME payment RPC to recover a delayed/missing webhook. This existing successful fallback must remain intact.
7. The RPC in `supabase/migrations/023_webhook_order_integrity.sql` locks checkout/snapshots/products/variants, validates amounts/ownership/items/seller portions, inserts `orders`, `order_items`, `seller_orders`, marks checkout paid, and runs the existing stock routine. Failure rolls back the database transaction; a successful Stripe charge is outside that transaction.
8. A permanent HolyHub order exists when this whole RPC transaction COMMITS, not when Stripe Session creation, browser redirect, an individual INSERT, or RPC function return inside an uncommitted transaction occurs. PostgREST manages the request transaction. Both creators get the same idempotent behaviour.

## Revised data design

Use typed fields instead of JSON: eliminate runtime JSON-to-integer casts from the paid-order transaction.

| Table | Added fields | Purpose |
|---|---|---|
| `lister_storefronts` | `dispatch_min_working_days`, `dispatch_max_working_days`, `dispatch_made_to_order`, `transit_min_working_days`, `transit_max_working_days` | Current shop settings, nullable for older shops |
| `checkout_session_sellers` | All five fields above plus `dispatch_promise_version`, `dispatch_promise_captured_at` | Fixed terms offered to that seller's customer at checkout start |
| `seller_orders` | The same seven snapshot fields | Permanent seller-specific purchased terms, copied in the EXISTING order transaction |
| `seller_orders` | `dispatch_confirmed_at`, `dispatch_confirmation_event_id`, `dispatch_due_at` | Once-set provider confirmation anchor and resulting dispatch deadline |

Times are `timestamptz`; ranges/version are `smallint`; made-to-order is nullable boolean. No existing data defaults to an invented promise or a false made-to-order assertion. Historical new columns are all NULL.

Constraints:

- Shop dispatch fields are all absent, or all present with an integer 1–365 day range and a known made-to-order flag.
- Transit bounds are both absent, or both present and ordered within 1–365.
- Checkout/order snapshots are entirely absent, or complete version 1 snapshots with valid ranges and a finite capture timestamp. Optional transit remains a valid pair or an absent pair. Explicit non-null checks prevent SQL CHECK's NULL semantics from permitting partially populated required snapshots.
- Order timing is entirely absent, or has a finite confirmation timestamp, Stripe event ID, finite deadline after confirmation, and an existing version 1 promise.

The private `holyhub_dispatch_deadline` helper counts Monday–Friday in Europe/London, starting on the next date, with the final day inclusive. Bank holidays are deliberately not excluded. Three working days after a Friday confirmation allows dispatch through Wednesday; due time is Thursday 00:00 London, including correct DST conversion. Missing/invalid optional inputs return NULL, not a parsing exception.

The index `seller_orders_dispatch_attention_idx` indexes known due times for pending/packed portions. It does not change statuses or cancel orders.

## Exact checkout/order application changes prepared

Authoritative reviewable patch: `docs/proposals/dispatch-promises.integration.patch`. Full staged route sources and helper live alongside this report. The patch has NOT been applied to the working app.

- `app/checkout/actions.ts`: extend the EXISTING shop read with five dispatch/transit fields; make one validated snapshot per seller from that read; include it in the existing checkout-seller insert. Missing legacy settings produce no promise, without a new checkout rejection. No extra Stripe calls or changes to its request, amounts, commissions, delivery calculation, payment methods, metadata or redirect sequence.
- `lib/dispatch-promise.ts` (new staged helper): validate/copy typed terms, build arguments from an already verified successful Stripe Checkout event, and attempt optional timing enrichment with a 1.5-second abort signal. Errors become an unavailable timing state, never a payment exception.
- `app/api/stripe/webhook/route.ts`: reuse the server client; keep the original payment RPC and its exact arguments/checks/responses; AFTER it commits a paid order, call `record_order_dispatch_confirmation`. Timing failure logs event/session identifiers and leaves the existing successful response intact. No extra Stripe API request.
- `scripts/reconcile-dispatch-confirmation.mjs` (staged, NOT RUN): an explicitly invoked repair tool reads an existing Stripe successful Checkout event, verifies the matching permanent paid order/total/currency and fills UNKNOWN timing only. It never calls the payment processor, creates an order, changes stock/status, charges or refunds. Each future invocation requires separate authorization for its target write. It can retrieve test/live events only with the matching configured key; no key is logged.
- `app/checkout/success/page.tsx`: NO code change. Same ownership/payment validation and same seven-argument RPC. The database copy automatically preserves the promise through this path too.

`process_checkout_payment` is replaced only to append the seven typed fields to the existing seller-order INSERT/SELECT. Its signature, guards, amount calculations, locking, status updates, item writes, duplicate protection and stock call stay identical. No deadline helper or dispatch parsing is called inside it. An offline text-comparison test removes exactly these appended fields and compares the entire function body against the current migration source.

Snapshot capture occurs at checkout start, not webhook receipt. This is the promise offered for that Checkout Session and remains its terms until that Session completes/expires, even if the lister edits settings before payment. Future customer-facing copy must use those offered terms; it must not claim they are whatever happens to be in shop settings at payment time. This matches the existing delivery-price snapshot model.

## Payment timestamp and once-set deadline

Use `event.created` from the SIGNED successful `checkout.session.completed` event whose Session is paid, or `checkout.session.async_payment_succeeded` for delayed payment. It is Stripe's confirmation-event creation timestamp, not an asserted exact card-capture timestamp. Never use checkout-start time, webhook receipt time, browser parameters, database `now()`, or Session/PaymentIntent creation time as payment confirmation time.

`record_order_dispatch_confirmation` is a separate SECURITY INVOKER RPC, restricted to service_role, with an additional current-user guard. It verifies the exact paid parent/session/checkout relationship, locks the parent order to serialize concurrent timing fills, and updates only version 1 paid seller portions whose deadline is still NULL. It computes from the permanent SELLER ORDER promise, not current settings or a fresh checkout read. It does not update fulfilment `updated_at`, statuses, amounts or notes.

Later events, retries and shop changes cannot move a known deadline through this RPC. First valid confirmation wins. Real deferred-payment completion is unpaid and is excluded; the later paid success event supplies the anchor. A second valid event cannot overwrite it.

Success-page-first creation preserves all promises atomically but leaves deadline unknown until the signed event arrives. The subsequent webhook calls the normal idempotent payment RPC, then fills timing for the existing record. If timing enrichment fails or the webhook never arrives, the paid order and promise remain valid; no overdue date is invented. It must display “Dispatch timing needs verification” to admin/lister, with operational review, rather than green/all-caught-up or red/overdue based on order age. Repair uses the original successful Stripe event and the restricted helper; do NOT replay payment processing just to repair timing. Event availability is subject to Stripe retention, so inspect/repair promptly. If an authentic source is unavailable, keep timing unknown.

This optional post-commit step is a deliberate safety trade-off: the purchased promise is atomic with order creation; the exact provider-event anchor may arrive later. It is impossible to promise both unchanged successful payment responses and an always-known provider timestamp during a total event-delivery outage. No background queue/worker or fabricated fallback timestamp is added here.

## RLS/security implications

No policy is created, altered, dropped or disabled. No role/auth changes, new table, trigger, cron or new SECURITY DEFINER function.

- New shop column INSERT/UPDATE grants to authenticated still rely on the existing own-lister RLS. Existing public shop SELECT includes the new customer-facing estimates.
- Checkout snapshots remain server-only under existing RLS/grants. Explicit INSERT grants cover the seven added fields.
- Existing seller-order SELECT RLS continues to restrict customers/listers to entitled rows and permits admins.
- No authenticated UPDATE grant is added for snapshots or deadlines; existing fulfilment editing grants stay unchanged.
- Server receives SELECT permission for the six seller-order columns used by the timing predicate/calculation, and UPDATE permission for only the three timing fields. Existing server INSERT grants cover the seven snapshot fields.
- `private` schema USAGE and deadline-helper EXECUTE are granted to service_role; PUBLIC/anon/authenticated execution of new functions is revoked. New RPC is SECURITY INVOKER; it uses existing service-role permissions, not a new elevated owner context.
- The original payment RPC retains its EXISTING SECURITY DEFINER/service-only boundary and empty search path. No new bypass is introduced there.
- Privileged database owners/service credentials are trusted. “Immutable” means ordinary lister/customer APIs and the approved application operations cannot rewrite saved promises/deadlines; this is not tamper-proof protection against a database owner. Do not grant clients table-wide UPDATE privileges later.

## Multi-lister and historical behaviour

Existing `(checkout_session_id, lister_user_id)` and `(order_id, seller_user_id)` identities are reused. One seller snapshot per seller, not per item or per basket; free-delivery sellers are included. Every permanent portion receives its own bounds, version and capture time. The same paid event anchors all portions but their deadlines differ according to each seller's maximum. Seller B remains pending/overdue even if seller A dispatched; there is no universal marketplace deadline. Monetary grouping is unchanged.

Historical orders and already-open legacy checkouts have no snapshots and stay NULL. They do not become retrospectively overdue. Subsequent shop edits, event replay and the timing-repair RPC do not backfill these old seller rows. If the existing payment routine repairs a historical missing child, a legacy NULL checkout snapshot still copies NULL. New checkouts with legacy/unconfigured shops also retain unknown promises until the shop has saved a valid one; preserving checkout is intentional. Launch can require shop configuration through the existing onboarding/settings UI before enabling customer promise messaging, without disabling otherwise-valid existing payments.

## Safe deployment sequence — approval REQUIRED

1. Approve this packet for ISOLATED DATABASE VALIDATION, not blind production application.
2. With separate authorization, apply proposed SQL only to a disposable/local database and run the database acceptance tests below. This task explicitly ran no SQL, even locally.
3. Verify actual target grants/function definitions still match the repository source. Do not overwrite a diverged live payment function. Decide whether regular transactional DDL/index locks fit the deployment window.
4. After separate migration approval, apply the schema first while the old app runs. Old checkout rows save NULL, and both existing payment paths remain compatible.
5. Deploy the prepared checkout/webhook/helper changes only after all schema objects are present. No automatic missing-column probes, silent retry into another payment path, feature flag backed by missing columns, or applied patch before approval.
6. Wire existing shop/onboarding settings to the five fields: options 1–2, 2–3, 3–5, 5–7 or made to order with integer min/max; transit separate and optional. Require fields on new saves in that UI, preserve old missing settings as unknown. This UI work is part of activation, not present in the staged checkout-only patch.
7. Display deadlines only from seller_orders; include both known overdue pending/packed and version 1 orders with unknown timing in operational attention views. Unknown historical promises remain labelled unknown. Enable customer dispatch/transit copy only when it matches the captured terms. No auto-cancellation.
8. Validate webhook delivery, success-page-first recovery, monitoring and approved repair procedure before calling the dispatch feature launch-ready.

## Rollback implications

The migration is wrapped in BEGIN/COMMIT; failure during application rolls back its DDL. Applying it requires table/index locks and may briefly block writes. It is single-use, not an idempotent script.

After deployment the preferred rollback is APPLICATION FIRST: restore the current checkout/webhook code and leave the additive nullable columns/data in place. The existing seven-argument RPC is compatible and continues copying any snapshots on in-flight checkouts. Stop advertising new promises, but keep fulfilling previously sold promises and preserve saved deadlines.

Do not drop snapshot columns or replace the payment routine with its old version while in-flight version 1 checkout sessions remain: doing so would lose promises when those sessions pay. Do not drop columns referenced by the amended routine. Full schema removal would require a separate reviewed retention/export plan, waiting for or resolving in-flight checkouts, restoring the original payment function, and removing dependent RPC/helper/index/grants in a deliberate order. Dropping columns destroys purchased-term evidence. A database rollback never refunds/reverses an external Stripe charge.

## Acceptance tests BEFORE production approval (not executed SQL)

- Apply/rollback the exact SQL on a disposable database with the existing migrations; verify grants, CHECK NULL behaviour and function signatures.
- Under real roles/RLS, customers/other listers cannot edit shop settings, checkout promises, order promises or timing; authenticated callers cannot execute the timing RPC. service_role can fill timing once only.
- Existing seven-argument callers with entirely NULL checkout fields still create exactly the same parent/items/seller records and decrement stock once.
- Two/three sellers, including free delivery and repeated items from the same seller: one portion each, correct independent promises/deadlines and unchanged totals/fees/stock.
- Edit each shop after checkout capture and after payment; verify all existing snapshot fields and known deadlines stay byte-for-byte unchanged.
- Exercise both webhook-first and success-page-first order creation; race them and duplicate confirmations concurrently. Exactly one order and stock decrement; known timing never moves.
- Simulate stale/unpaid completion, async success, async failure, expiry, late failure and delayed webhook/replay across a weekend. No premature fulfilment/overdue date, no paid-state reversal.
- Check London local midnight, weekend starts, minimum 1 and maximum 365, leap year, spring/autumn DST, final-day boundary and documented bank-holiday treatment.
- Partial/range-invalid version 1 snapshots are refused at checkout persistence BEFORE redirect to Stripe; entirely absent legacy snapshots remain allowed. Never introduce JSON cast failures into paid-order processing. Under the prepared app, incomplete legacy/invalid settings simply omit a snapshot.
- Simulate enrichment timeout/unavailable RPC/permission failure: payment/order/stock remain committed, original webhook HTTP success stays intact, identifier-only warning is emitted, timing stays unknown and approved repair fills once.
- Historical rows and legacy in-flight checkout sessions remain unknown after replay/repair; new version 1 missing-timing rows can be identified separately.
- Invalid/unrelated confirmation parameters must not fill timing; repeat repair must change zero already-set rows. Verify repair never invokes any payment/stock operation.
- Existing product approval, bulk import/duplicates, draft/archive, stock, delivery totals and customer/lister fulfilment regression tests.

## Approval assessment

The revised design removes the JSON-cast payment failure and receipt-time deadline defects and covers both real order creators. It is ready for approval to proceed with isolated database validation and coordinated implementation. It is NOT yet certified safe to apply directly to production: the proposed SQL has intentionally not been executed, real-role/concurrency/calendar behaviour must be verified, and activation UI/attention handling must be implemented before advertising the feature. Payment request/totals and outcome-preservation have offline comparison tests; runtime SQL validation remains an explicit approval gate.

References checked: Stripe Event `created` means event creation time (https://docs.stripe.com/api/events/object); Checkout fulfilment docs (https://docs.stripe.com/checkout/fulfillment). The source of truth for existing payment/role behaviour in this report is the repository, not an inferred dashboard configuration.

## Verification completed without database access

- Eight new offline proposal tests passed, covering immutable copies, validation, paid-event timestamps, optional enrichment errors, multi-lister/free-delivery checkout preservation, unchanged payment RPC arguments/responses, deferred/failure events and an exact text comparison of the payment function.
- Forty selected offline proposal/payment/checkout/fulfilment tests passed, zero failures/skips. The real-Postgres test harness was deliberately not selected because this task prohibits executing SQL.
- Root lint passed. The staged checkout/webhook/helper were additionally typechecked and built in `/tmp/holyhub-dispatch-review-uk7rx02m`, using copied source, fake local public configuration and NO Stripe or Supabase server credentials. The approved patch was only materialized in that disposable build copy; the shared working application's routes remain unchanged.
- Isolated production build passed using webpack (the temporary copy symlinks installed dependencies). The sandbox initially blocked TypeScript's subprocess output; the same offline build succeeded outside the sandbox.
- Repair script syntax check passed; the script was NOT executed. `git apply --check` passed for the staged patch; this checks applicability only and does not apply it. `git diff --check` passed.
- No SQL was executed, including schema queries, local database tests or migrations. No application credential was used by these checks. SQL correctness/security/concurrency is still a future isolated-database approval gate.

The earlier unrelated full-suite dashboard-markup failure remains outside this proposal's scope; this selected regression run did not change that dashboard or its test.
