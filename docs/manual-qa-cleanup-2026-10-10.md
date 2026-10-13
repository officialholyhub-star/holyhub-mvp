# Final manual QA cleanup — 10 October 2026

## Results by requested section

| Section | Result | Change |
| --- | --- | --- |
| 1 | PASS | Directory includes approved applicants and existing lister-role accounts; joins products by user ID. Full catalogue, all states; live requires approved AND published. |
| 2 | PASS | Correct allowance wording below ten, at ten and above ten; no billing added. |
| 3 | PASS | Marketplace omits quantity controls; adds one per click. Product detail and basket quantity controls remain. Zero-stock/all-sizes-sold-out disables purchase. |
| 4 | PASS | Fresh public product checks identify affected basket lines and stock, size, price or delivery issues; warnings, remove/review actions and scrolling. Explicit acceptance updates display information. Original server checkout revalidation remains untouched. |
| 5 | PASS | Product count drops “real”; existing demo catalogue preview restricted to development, excluded in production. |
| 6 | PASS | Profile and Email have separate white bordered cards with clear headings and spacing. |
| 7 | PASS | Prominent Account management section links to the existing honestly labelled deletion REQUEST; confirmation/review safeguards unchanged. |
| 8 | PASS | “Storefront settings” uses the existing SVG icon component with an added gear icon. |
| 9 | PASS | Existing four soft-pink admin subsection headings retained. |
| 10 | PASS | Unreliable last-active row removed; no tracking added. |
| 11 | PASS | Delivered background strengthened to #dcefe2 with #568765 border for lister/admin and customer seller portions; status text unchanged. |
| 12 | PASS | Pending dispatch proposals, staged patch/helper/routes and tests preserved; not enabled/applied. |

## Catalogue root cause and evidence

Read-only SELECT checks against the configured project showed two separate lister user IDs with the same storefront name. One owns 1 approved/published product and has an approved application. The other owns 14 products (8 approved/published, 6 drafts), has lister/admin roles, and has no application record.

The directory previously iterated only approved application rows. It therefore excluded the second account entirely; it was not filtering thirteen products out of that account. Public/admin product SELECT policies were already present. No policy repair, account reassignment, name-based merge or elevated service client is necessary.

The directory now unions approved applicants with actual lister-role accounts, deduplicates by user_id, and uses products.lister_user_id = that user_id exactly as the lister catalogue does. The admin list/detail share those product rows and counts. Account IDs distinguish matching shop names. Role-enabled accounts without applications are honestly labelled as such; no application is fabricated. Regression rendering verifies both the 1-product account and the complete 14-product account.

Approved is NOT equivalent to live: live requires review_status='approved' AND is_published=true. An approved but unpublished product remains counted in total and displayed as approved/hidden (archived), without increasing live. Draft, pending and rejected states stay in total and in detail. No public visibility rules changed.

## Basket and payment safety

No change to app/checkout/actions.ts, Stripe calls, webhook, success reconciliation, totals/commission, stock routines or payment statuses in this cleanup. Browser preflight is only a usability check; it never supplies trusted prices to Stripe or replaces server validation. Existing startCheckout independently reloads products/variants, eligibility, stock, delivery and authoritative prices and retains all existing rejection conditions.

Missing products are described as unavailable rather than leaking their private draft/review state. Fresh available prices and delivery changes are shown accurately. Explicit review updates local display information only. Preflight data failure blocks that attempt with a retry message. Server rejection still returns to the basket, whose refreshed item data supplies specific warnings where known. Existing payment/order concurrency safety remains in the unchanged server implementation.

Account deletion remains a reviewed email request, not immediate deletion or a stored support ticket. Users must send the prepared email. The account stays active; outstanding fulfilment/payments and required retention are reviewed manually. No cascading deletion or auth mutation was added.

## Verification

- New regression cases cover the actual rendered admin directory, duplicate shop names, role-only lister, all-state/live counts, allowance counts 0/9/10/11/14, basket problem reasons, explicit price/stock review, quantity visibility and zero/all-variant stock guards, and account management visibility.
- Final selected suite: 38 passed, zero failures/skips.
- Full suite run: 186 tests; 181 passed, 1 known existing failure, 4 opt-in database tests skipped. Failure: tests/fulfilment-summary.test.mjs:72 expects the old FulfilmentSummary dashboard component; the dashboard already used summary tiles before this cleanup. Only its requested settings label/icon changed here. No test was modified to hide the mismatch.
- Offline Chromium interaction test passed against actual BasketView/AddToBasketButton with synthetic data and mocked service boundaries: specific warnings, review/removal, successful valid-basket action, stock change after render, unavailable-data blocking, marketplace add-one and out-of-stock guard, basket overflow checks at 320/390/768/1440px. No Supabase/Stripe browser calls. Browser testing found and corrected a resubmission issue before completion; final code uses a client form action delegating directly to unchanged startCheckout.
- Lint and production webpack build passed. Next's initial sandboxed build could not read TypeScript subprocess configuration; the outside-sandbox production build succeeded.
- git diff --check passed. Pending dispatch proposal/report/helper/local-validation checksums remain unchanged; staged dispatch route files were not edited.

Logs: /tmp/holyhub-qa-cleanup/{selected-final.tap,full.tap,lint-final.log,build-final.log}. Browser script: tests/manual-qa-cleanup.browser.mjs. Its temporary esbuild/playwright dependencies were installed only under /tmp/holyhub-ux-browser; repository dependencies were not changed by this task.

No migration was applied, no database writes were made, RLS was neither changed nor weakened/bypassed, and dispatch work remains pending final integration verification.

## Exact files changed in this cleanup

- app/admin/listers/page.tsx
- lib/admin-listers.ts (new)
- app/lister/products/page.tsx
- components/add-to-basket-button.tsx
- app/marketplace/page.tsx
- components/basket-view.tsx
- lib/basket-availability.ts (new)
- app/account/page.tsx
- app/account/page.module.css
- components/holyhub-icon.tsx
- app/lister/page.tsx
- app/globals.css
- tests/manual-qa-cleanup.test.mjs (new)
- tests/manual-qa-cleanup.browser.mjs (new)
- docs/manual-qa-cleanup-2026-10-10.md (this report)

Other pre-existing workspace edits remain untouched.

## Next manual browser checks, in order

1. Admin Live Listers: distinguish same-name accounts using account IDs. Open the 14-product account: 14 total, 8 live, 6 drafts; open all states and product links. Confirm drafts remain absent publicly and an approved hidden product does not increase live.
2. Lister catalogue: at 14 products, verify four beyond the free allowance and billing-disabled wording. On suitable test accounts check below/exactly ten without deleting real products just to test copy.
3. Marketplace: count says “products”; no +/- controls; Add to basket adds one; sold-out product is disabled. Product-detail and basket quantities still work. Production results contain no demo filler cards.
4. Basket: add multiple products, then change stock/price/delivery or availability in another test session (complete existing approval steps where required). Confirm the exact affected line/reason, highlight, scroll on failed checkout, remove and explicit updated-information actions. Fix issues and complete one Stripe TEST checkout; confirm authoritative totals and the paid order.
5. Account: check separate Profile/Email cards; save profile and verify email action remains present. Open Account management → Request account deletion, test invalid DELETE/unchecked acknowledgement, then valid confirmation opening the request email. Confirm account and orders remain intact.
6. Lister dashboard: open Storefront settings via its gear link; verify existing delivery save/reload. Check delivered green/text in lister, admin and customer views, then repeat basket/account screens at phone width.
