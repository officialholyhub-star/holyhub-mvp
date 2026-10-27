# C12 read-only stage/shared migration preflight — 24 October 2026

**Decision: BLOCKED / NEEDS FIX. The exact current local migration directory is not safe to apply unchanged to stage. Do not apply any migration from this report.**

Only read-only project discovery, history inspection, catalogue inspection and aggregate impact counts were performed remotely. Every SQL inspection was enclosed in `BEGIN READ ONLY; ...; COMMIT;`; the server returned `transaction_read_only = on`. No remote DDL/DML, migration execution, history repair, role creation, database reset, financial RPC, Stripe action, deployment or secret change was performed. No source/migration file was edited. This new local report is the only repository change made by this preflight.

## 1. Target identity and local link state

- Application target: **holyhub-stage4-test**, project ref **ueqwzpuiuidihzhtbmvo**, region **eu-west-1**, active/healthy, PostgreSQL **17.6**.
- `.env.local` and `.env.development` point to `ueqwzpuiuidihzhtbmvo.supabase.co`. Only URL hostnames and credential-presence flags were inspected/output; no credentials are included here.
- Connected Supabase project discovery confirms the same project. Branch listing returned **no development branches**. This inspection therefore targeted the project database, not an identified preview branch. Git branch is `alea/stage4-payments`; it is not evidence of a Supabase branch.
- This checkout has **no `supabase/.temp/project-ref`, `supabase/config.toml` or `.branches` link metadata**. It is app-configured to stage, but is not currently CLI-linked in this working directory. No link was created.
- Remote history has **34 entries**, newest **20261018203559**. This count/latest version was rechecked after inspection and was unchanged.

## 2. Remote migration versions currently recorded

| Remote version | Recorded name |
| --- | --- |
| 20260914110602 | stage1_foundation |
| 20260914110619 | business_discovery |
| 20260914110723 | marketplace |
| 20260914110746 | marketplace_storage |
| 20260914110804 | payment_boundary |
| 20260914110822 | order_delivery |
| 20260914110836 | launch_readiness |
| 20260914110858 | events_directory |
| 20260926215728 | stage5_shipping_orders |
| 20260926215733 | stage6_favourites |
| 20260926220418 | product_review_status_guard |
| 20260926223035 | product_images_storage |
| 20260926223135 | reconcile_product_images_bucket |
| 20260926232216 | lister_storefront_branding |
| 20260927182909 | product_review_actor_guard |
| 20261001191931 | checkout_seller_delivery_and_moderation_grants |
| 20261001191943 | apparel_product_variants |
| 20261001191955 | product_review_edit_snapshots |
| 20261001192004 | carrier_neutral_fulfilment |
| 20261001192014 | order_delivery_address |
| 20261001192025 | bulk_product_csv |
| 20261001192033 | product_gallery |
| 20261001193007 | anonymous_product_variant_reads |
| 20261001195729 | 023_webhook_order_integrity |
| 20261002123924 | 024_bulk_product_images |
| 20261007141642 | stripe_fee_payout_breakdown |
| 20261009211224 | lister_approval_role_permissions |
| 20261017202221 | seller_legal_identity |
| 20261017202301 | c6_durable_order_confirmation |
| 20261017202315 | c6_dispatch_visibility_gate |
| 20261017202338 | c6_notification_worker_primitives |
| 20261017203353 | c9_lister_terms_acceptance_gate |
| 20261018172124 | flexible_dispatch_working_days |
| 20261018203559 | audit_readiness_hardening |

## 3. Current local migration history/order and mapping

There are **39 local SQL files**. The following is their filename/application order. **None of their version IDs exactly matches a recorded remote ID.** This does not mean all 39 changes are unapplied: **26 files match recorded remote SQL tokens**, preserving quoted strings while ignoring SQL comments, whitespace and unquoted keyword case. This comparison also resolves the earlier uncertainty around migration 025: its recorded SQL matches local 025 under this comparison.

The seven unmatched historical files are 001, 002, 003, 004, 007, 008 and 013. Profiles, applications, products/storefronts, checkout tables and review fields from the first six are present live, but their exact local SQL is not represented as matching history entries. `church_profiles` from 013 is **absent** live and has no matching recorded SQL. Do not infer a one-to-one mapping from legacy remote migration names such as `business_discovery` or `marketplace`: their recorded SQL describes materially different historical structures.

| Local filename, in order | Remote SQL equivalence / status |
| --- | --- |
| `001_stage1_foundation.sql` | No exact recorded SQL equivalent; feature objects/fields exist; provenance reconciliation required |
| `002_lister_applications.sql` | No exact recorded SQL equivalent; feature objects/fields exist; provenance reconciliation required |
| `003_stage3_marketplace.sql` | No exact recorded SQL equivalent; feature objects/fields exist; provenance reconciliation required |
| `004_stage4_checkout.sql` | No exact recorded SQL equivalent; feature objects/fields exist; provenance reconciliation required |
| `005_stage5_shipping_orders.sql` | Already represented by 20260926215728 (stage5_shipping_orders); different version ID |
| `006_stage6_favourites.sql` | Already represented by 20260926215733 (stage6_favourites); different version ID |
| `007_lister_review_workflow.sql` | No exact recorded SQL equivalent; feature objects/fields exist; provenance reconciliation required |
| `008_product_review_workflow.sql` | No exact recorded SQL equivalent; feature objects/fields exist; provenance reconciliation required |
| `009_product_review_status_guard.sql` | Already represented by 20260926220418 (product_review_status_guard); different version ID |
| `010_product_images_storage.sql` | Already represented by 20260926223035 (product_images_storage); different version ID |
| `011_reconcile_product_images_bucket.sql` | Already represented by 20260926223135 (reconcile_product_images_bucket); different version ID |
| `012_lister_storefront_branding.sql` | Already represented by 20260926232216 (lister_storefront_branding); different version ID |
| `013_church_profiles.sql` | No matching history entry; church_profiles table absent; unrelated to C12 |
| `014_product_review_actor_guard.sql` | Already represented by 20260927182909 (product_review_actor_guard); different version ID |
| `015_checkout_seller_delivery_and_moderation_grants.sql` | Already represented by 20261001191931 (checkout_seller_delivery_and_moderation_grants); different version ID |
| `016_apparel_product_variants.sql` | Already represented by 20261001191943 (apparel_product_variants); different version ID |
| `017_product_review_edit_snapshots.sql` | Already represented by 20261001191955 (product_review_edit_snapshots); different version ID |
| `018_carrier_neutral_fulfilment.sql` | Already represented by 20261001192004 (carrier_neutral_fulfilment); different version ID |
| `019_order_delivery_address.sql` | Already represented by 20261001192014 (order_delivery_address); different version ID |
| `020_bulk_product_csv.sql` | Already represented by 20261001192025 (bulk_product_csv); different version ID |
| `021_product_gallery.sql` | Already represented by 20261001192033 (product_gallery); different version ID |
| `022_anonymous_product_variant_reads.sql` | Already represented by 20261001193007 (anonymous_product_variant_reads); different version ID |
| `023_webhook_order_integrity.sql` | Already represented by 20261001195729 (023_webhook_order_integrity); different version ID |
| `024_bulk_product_images.sql` | Already represented by 20261002123924 (024_bulk_product_images); different version ID |
| `025_stripe_fee_payout_breakdown.sql` | Already represented by 20261007141642 (stripe_fee_payout_breakdown); different version ID |
| `026_seller_legal_identity.sql` | Already represented by 20261017202221 (seller_legal_identity); different version ID |
| `20261009151400_lister_approval_role_permissions.sql` | Already represented by 20261009211224 (lister_approval_role_permissions); different version ID |
| `20261017200000_c6_durable_order_confirmation.sql` | Already represented by 20261017202301 (c6_durable_order_confirmation); different version ID |
| `20261017200500_c6_dispatch_visibility_gate.sql` | Already represented by 20261017202315 (c6_dispatch_visibility_gate); different version ID |
| `20261017201000_c6_notification_worker_primitives.sql` | Already represented by 20261017202338 (c6_notification_worker_primitives); different version ID |
| `20261017204000_c9_lister_terms_acceptance_gate.sql` | Already represented by 20261017203353 (c9_lister_terms_acceptance_gate); different version ID |
| `20261018010000_audit_readiness_hardening.sql` | Already represented by 20261018203559 (audit_readiness_hardening); different version ID |
| `20261018090000_flexible_dispatch_working_days.sql` | Already represented by 20261018172124 (flexible_dispatch_working_days); different version ID |
| `20261019105706_c11_guarded_payments.sql` | Pending C11→C12 addition: no history entry and its new objects absent |
| `20261020112737_a110_c11_rpc_execute_permissions.sql` | Pending C11→C12 addition: no history entry and its new objects absent |
| `20261020195527_a113_holyhub_processing_fee_credits.sql` | Pending C11→C12 addition: no history entry and its new objects absent |
| `20261022162816_bind_lister_terms_acceptance.sql` | Pending C11→C12 addition: no history entry and its new objects absent |
| `20261023144733_a138_processing_fee_responsibility.sql` | Pending C11→C12 addition: no history entry and its new objects absent |
| `20261024073605_c12_delivery_territory.sql` | Pending C11→C12 addition: no history entry and its new objects absent |

The local order has audit-readiness before flexible-dispatch, while remote applied flexible-dispatch before audit-readiness. Both recorded files match local SQL and both are already present; they must not be replayed merely to reproduce local ordering.

**Consequences:** a generic full-directory migration operation is not an established deployment route. Replaying local 001/003/004 would attempt to recreate existing types/tables; replaying 007/008 would attempt to add existing review columns/types/policies. Replaying C5/C6/C9 equivalents would similarly duplicate existing tables, columns and triggers. The remote ledger also contains eight earlier historical entries without a simple current local-file counterpart. Obtain an authoritative, reviewed migration-history mapping before using migration tooling; do not rename historical files, repair history or reset stage as part of this preflight.

## 4. Six pending files and exact prerequisite sequence

This is the **ordered current-file addition set**, not authorization to execute it:

1. `20261019105706_c11_guarded_payments.sql`
2. `20261020112737_a110_c11_rpc_execute_permissions.sql`
3. `20261020195527_a113_holyhub_processing_fee_credits.sql`
4. `20261022162816_bind_lister_terms_acceptance.sql`
5. `20261023144733_a138_processing_fee_responsibility.sql`
6. `20261024073605_c12_delivery_territory.sql`

| Migration | Required baseline / reason for order | Stage assessment |
| --- | --- | --- |
| C11 `20261019105706` | Existing orders/items/seller orders, fee columns (025), legal snapshots (026/C5), C6 notification/dispatch tables/triggers, C9 version/acceptance tables. Creates nine financial tables, private seller lock, financial RPCs, status guards and ledger triggers; grants service_role USAGE on private. | Known baseline columns/functions exist; new C11 objects absent. Do not apply yet: history gate, runtime service SELECT gap, coordinated app/terms rollout. |
| A110 `20261020112737` | C11 creates the exact financial function signatures that A110 revokes/grants. | Must follow C11 and precede any use of the new financial API. Applying alone would reference absent functions. |
| A113 `20261020195527` | C11 payment_operations, allocation/refund ledger and function signatures. Adds version column/constraints, fee-credit table/functions and replacement accounting/claim/settlement routines. | Must follow C11; retain A110 ACL hardening. New credit objects/version column absent remotely. |
| Bound terms `20261022162816` | Existing C9/audit-readiness `accept_current_lister_terms(text)` and terms tables. Drops the unbound endpoint and creates `(text,text,text)`. | Old one-argument endpoint exists and has no recorded database dependents; no new overload collision. Coordinate app rollout: old clients calling one argument will fail. No terms activation is performed. |
| A138 `20261023144733` | C11 plus A113 tables, named version constraint, fee-credit helpers and payment kind. Adds independent responsibility/reimbursement ledgers and v2 wrappers. | Must follow A113; no new-table/function/index/trigger collisions found. Not independently applicable to current remote baseline. |
| C12 `20261024073605` | Existing checkout_sessions/items/sellers, orders/items/seller orders, legal/dispatch snapshots and inventory RPCs; preserves the C11 payment implementation and relies on C11 ledger/cancellation/correction triggers and private-schema service USAGE. Adds delivery_address, NI interest and invoker processing. | **NEEDS FIX**: current service privileges cannot execute the invoker body. Also requires coordinated snapshot-producing checkout app and legacy-session plan. |

C12 does not directly reference A113/A138 columns in its function body, so those are not standalone DDL-compilation prerequisites for its address column. They remain required parts of the approved full local C11/refund behavior; omitting them would not deploy the audited current chain. C12 does directly rely on the C11 private-schema privilege grant and must preserve the ledger/status protections installed by C11. The bound-terms migration is likewise a working-tree application/API prerequisite, rather than a direct dependency of the C12 address column.

`013_church_profiles.sql` is an additional genuinely missing local feature migration, but **is not a C12 prerequisite**. Do not silently include it in a C12 stage batch; it needs separate scope approval and history treatment.

**There is no safe executable unchanged sequence today.** After baseline/history reconciliation and a separately reviewed, forward-only service-privilege remediation, the six files above retain that exact relative order. The privilege repair must be effective before C11 service RPCs/C12 invoker processing are used. Its migration filename/order has not been invented or created here. An approved staged plan must also coordinate application compatibility and legacy sessions. No ready-to-run migration command is proposed.

## 5. Concrete privilege blocker and why local tests did not prove stage parity

Read-only `has_table_privilege` / `has_any_column_privilege` checks returned:

| Required operation | Live service_role privilege | Result |
| --- | --- | --- |
| SELECT public.seller_orders | No table SELECT and **no SELECT column at all** | C11 invoker `sync_payment_order`, request/refund/transfer paths and security-invoker reconciliation views need seller-order reads. C12 also reads seller_orders when validating existing seller portions. Will fail with insufficient privilege. |
| Lock checkout_session_sellers FOR UPDATE | SELECT yes; **no UPDATE privilege on any column** | C12 invoker snapshot lock at migration line 157 requires UPDATE privilege in addition to SELECT. Will fail with insufficient privilege. |
| Lock checkout_session_items/products/product_variants FOR UPDATE | SELECT and at least one UPDATE column available | Checked lock prerequisites present. |
| INSERT columns named by C12 into orders/seller_orders | Every explicitly inserted column checked true | Table-wide INSERT is false for these tables, but the existing column grants cover the explicit insert lists. Do not misdiagnose this as a need for broad INSERT grants. |
| private schema USAGE | Currently false | C11 supplies this grant. C12 must not be treated as standalone safe on the current baseline. |
| process_checkout_payment EXECUTE | anon=false; authenticated=false; service_role=true | Current RPC entry ACL is restricted. C12 preserves REVOKE/GRANT and invoker security; do not reintroduce auth.role or a definer shortcut. |

None of the six pending files supplies the missing seller_orders SELECT or seller-snapshot UPDATE privilege. A110 grants **function EXECUTE**, which does not supply underlying table privileges. The needed remediation is narrow, reviewed service-only privileges appropriate for these reads/row locks, with snapshot safeguards retained—not broad anon/authenticated access, and not restoring deprecated JWT checks.

The disposable database test bootstrap explicitly runs `alter default privileges in schema public grant all on tables to service_role`. That grants more than stage currently grants, so its passing service-role tests do not prove this stage ACL transition. Before approval, reproduce the actual stage grants in a disposable environment and rerun the invoker checkout, C11 sync/refund/release paths and reconciliation reads. No replay or local database writes were performed during this read-only preflight.

## 6. Drift/conflict and replacement findings

- **No collisions found for the six additions:** their new tables/views/functions, named indexes and triggers are absent remotely. C12 delivery_address is absent. A113/A138 version constraints belong to tables created earlier in the pending sequence; their named DROP/ADD operations must not be applied out of order.
- **Current baseline functions:** 29 live public/private function bodies match their latest recorded definitions under token comparison. `private.has_role` has no matching creation entry in the stored history inspected, and `public.handle_new_user` differs from its last recorded legacy definition; both live bodies match local 001. This is historical provenance drift that must be reconciled, not a new C12 function conflict.
- **RPC signatures:** live process_checkout_payment has the expected seven arguments and uuid result. The planned same-signature replacements do not show a return-type/argument-name conflict. Existing C9 acceptance has precisely the expected old text signature; no pg_depend dependents were found on it.
- **Intentional breaking replacement:** bound-terms removes a public API signature. C12 replaces the delivery-address authority and changes processing from definer to invoker, while keeping restricted EXECUTE. Both require an application-aware rollout; neither should be applied as an isolated stage patch under the current permissions.
- **RLS:** all 20 current public tables inspected have RLS enabled. Existing checkout/order owner/seller/admin policies remain present. The six additions contain financial/NI table RLS and explicit service-only grants/revokes. No need or approval to widen browser access was identified.
- **Legacy checkout impact:** 9 current checkout rows, **4 pending**, **0 paid sessions without an order**. All pre-C12 rows would have a null delivery_address; C12 intentionally refuses new order creation from a legacy session without a trusted snapshot. A separate reviewed treatment for the four pending sessions is required before rollout. No session was retrieved from Stripe, expired, refunded or otherwise changed.
- **Terms status:** only draft `2026-10-17-prelaunch-v1` is present; it has no active hash/activation. C11 adds a separate draft; none of these migrations activates terms or configures debt-recovery acceptance. This remains a launch gate, not permission to alter legal/policy content.
- **No destructive table drop identified in the six-file addition set.** The terms function DROP and A113/A138 constraint replacements are explicit contract changes, not generic historical cleanup. No broad schema diff or migration execution was attempted to resolve provenance uncertainty.

## 7. Files that must not be applied yet

- **All six pending additions:** hold the batch until the history, underlying service privileges, app compatibility and pending-session gates above are resolved and founder approval is supplied.
- **C12 specifically:** not safe on the inspected stage ACL, even after the exact other five files as currently written; narrow forward privilege remediation and stage-ACL local verification are required.
- **Historical equivalents (26 matches):** do not replay them under their different local IDs. They already correspond to applied SQL and would risk duplicate objects or overwriting later definitions.
- **001/002/003/004/007/008:** do not replay guessed baseline reconstruction against existing objects.
- **013 church profiles:** absent but unrelated to C12; do not include without its own reviewed decision.

## 8. Commands and connected read operations used

Local read-only commands/scripts:

- `pwd`; `git status --short`; `git branch --show-current`.
- `ls supabase`; `ls supabase/.temp`; checks for `supabase/.temp/project-ref`, `.branches`, `config.toml` and `.supabase` (absent link metadata).
- Cached CLI `/home/codespace/.npm/_npx/91eb58246759989d/node_modules/.bin/supabase --help` and `... supabase migration list --help` **only**. No remote CLI history/status command was run: there was no local CLI link, and connected read tools were sufficient. No login/link or temporary database-role provisioning was used.
- Python read hostnames from existing environment files without printing credentials; enumerated local migration files; SHA-256 preservation checks; compared local SQL tokens to recorded statements and live function bodies; checked pending object names against live catalogues. Intermediate non-secret metadata was saved under `/tmp` for analysis.
- Read relevant existing C11/C12 reports, migration SQL, test bootstrap and Supabase skill. No source file was changed.

Supabase connected tools:

- `list_projects`.
- `get_project(id='ueqwzpuiuidihzhtbmvo')`.
- `list_branches(project_id='ueqwzpuiuidihzhtbmvo')`.
- `list_migrations(project_id='ueqwzpuiuidihzhtbmvo')`.
- `execute_sql` on that project, for each of these explicit **BEGIN READ ONLY / COMMIT** inspections:
  1. SELECT version,name from supabase_migrations.schema_migrations ordered by version.
  2. SELECT catalog metadata for public/private relations, columns/defaults, function signatures/bodies/ACLs, triggers, constraints, policies and default ACLs.
  3. SELECT version,name,statements from schema_migrations ordered by version.
  4. SELECT transaction read-only context, aggregate checkout counts, non-content terms status, existing RLS and service/table/function privilege checks.
  5. SELECT row-lock privileges, per-column insert privileges, old-terms pg_depend metadata, payment policies and private-schema usage.
  6. SELECT indexname,indexdef from pg_indexes for public schema.
  7. SELECT migration count/latest version and transaction_read_only at the end: **34 / 20261018203559 / on**.

No SQL function with financial or mutating behavior was invoked. Counts/schema metadata were inspected instead of customer addresses, seller financial records or credential values.

## 9. Exact pending-file fingerprints

These freeze the inspected file contents; later approval must refer to reviewed contents and any separately approved remediation.

| File | SHA-256 |
| --- | --- |
| `20261019105706_c11_guarded_payments.sql` | `aa275fea4b4b908f4e335e17719b4c8b224e46c9f55838eeb697b54b5577e986` |
| `20261020112737_a110_c11_rpc_execute_permissions.sql` | `073857272b0e4a0a01d6c5a545e3f5e056edb3810ee6b281dd1bf7170f6a551c` |
| `20261020195527_a113_holyhub_processing_fee_credits.sql` | `62f0e868cecd33c512c87b76634fbc044667bd3901e128adb0e08ae5459fa8b2` |
| `20261022162816_bind_lister_terms_acceptance.sql` | `b8eb9a0d8dfc1e7e31dafdf29fdc9b2a56338d819579c1feddbc0eac5a31a61f` |
| `20261023144733_a138_processing_fee_responsibility.sql` | `aad9a9647b5edb5508db8e5298a4a679d562cb5633208f3fe3908ae378308dd4` |
| `20261024073605_c12_delivery_territory.sql` | `9918c28f4452944a8b4b524c56673fa3d387cf0d75a5c10c54d2b8d4cadde160` |

## 10. Final preservation and status

SHA-256 comparison against the start of this preflight confirmed **every pre-existing modified/untracked file unchanged**. No secret, source, migration or Git index edit occurred. Only this report was added. No remote writes occurred. Do not apply migrations based on this preflight.

`git status --short` (includes preserved pre-existing work):

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
?? docs/c12-stage-migration-preflight-2026-10-24.md
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
