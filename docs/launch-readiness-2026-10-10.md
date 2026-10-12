# HolyHub launch-readiness review — 10 October 2026

> Dispatch proposal update: the dispatch SQL and design described in this historical report have been superseded by [the v2 safety report](proposals/dispatch-promises/SAFETY-REPORT.md). No proposal has been applied.


## Changes in this batch

- Admin Live Listers keeps its existing expandable detail panels and application/contact/shop information. Adds soft-pink section headings, all product review states, image/name, stock, admin product links, outstanding preparation/dispatch counts and filtered order links. Reads pages beyond PostgREST's response cap.
- Existing admin product review component now supports read-only inspection of drafts, approved/hidden and rejected products via `?product=<id>`. Pending products retain the existing moderation controls and image navigation. Approved unpublished products are labelled hidden (archived); the schema has no separate archived status.
- New `/admin/orders` uses authenticated admin access and existing RLS. Shows seller portions of marketplace orders, current fulfilment filters, 50-card pagination, full reference, customer recipient/address, purchased items and sizes, amounts/commission/payout, order/cancellation state, tracking, dispatch/delivery dates and private operational notes. Order links show all seller portions of that order. No new status system or fulfilment mutation.
- Neutral, amber and green status rectangles for lister/admin cards and customer seller portions, retaining existing text badges. Red is reserved for a recorded failure requiring action; no arbitrary overdue threshold is invented.
- Existing delivery-charge storage and save action reused. Shop/onboarding UI explicitly offers Free delivery or Set my own price and keeps existing per-order charging. Soft-pink packaging/service guidance added.
- First setup welcome dialog reuses existing shop presence and onboarding cookie. Start, finish later and Escape advance existing setup state so it does not recur on subsequent visits in the same browser. Cookies are browser-specific; a new browser without a saved shop may see it again. No persistent global shown-once field was added.
- `/account/delete` requires DELETE and an acknowledgement before opening a deletion request email. The user must send it; the page does not store a request or claim successful submission. HolyHub manually verifies identity, outstanding fulfilment/payments and retention before acting. Account remains active. No cascading deletion or account-status/auth mutation.
- Confirmation screen keeps resend/sign-in, adds forgot-password and neutral reused-email guidance. Resend now handles provider errors rather than always claiming a new email is on its way. No auth configuration or confirmation policy changes.

## Existing architecture reused / preserved

Existing admin/lister role gates, RLS, product review workflow and gallery, draft/publish/archive semantics, stock, bulk importer/duplicate protection, order and seller-order statuses, saved delivery prices, order-item/address snapshots, order update/export tools, onboarding cookie and existing signup/callback/reset flow.

No migration was applied. No RLS policy was changed or weakened. Stripe checkout, webhook, payment and inventory code were not edited in this batch. Existing workspace edits from earlier work were preserved; this review does not claim ownership of those changes.

## Approval required: dispatch promise and transit estimates

Exact proposed SQL: `docs/proposals/dispatch-promises.sql` (outside automatic migrations, NOT APPLIED).

This adds nullable shop dispatch/transit working-day bounds and a made-to-order flag, checkout seller JSON snapshots, seller-order snapshot/deadline fields, an attention index, a Monday-Friday Europe/London deadline helper, and a narrowly amended copy of the existing atomic payment function that copies saved checkout promises into seller orders. Its existing validation, stock handling and access restrictions remain intact. No historical rows are backfilled from current shop settings.

The proposal has been reviewed as SQL text, not executed or database-tested. After explicit approval it must be tested on an isolated database before deployment. Approval to apply this SQL is separate from approval to deploy follow-up application changes.

Required follow-up implementation after approval:

1. Required onboarding/shop choice: 1–2, 2–3, 3–5, 5–7 working days, or made to order with validated numeric min/max estimate; optional separate transit bounds. Save via existing ownership RLS and add the requested dispatch-promise guidance.
2. At checkout initiation, read each seller's promise with its delivery price and copy versioned JSON into `checkout_session_sellers.dispatch_promise_snapshot`. Keys: `dispatch_min_working_days`, `dispatch_max_working_days`, `dispatch_made_to_order`, `transit_min_working_days`, `transit_max_working_days`. Never reread current shop promises to calculate existing order deadlines.
3. On payment, proposed transaction copies that snapshot and computes due time from purchase/payment time. Deadline includes the final working day, with counting starting the next day. Bank holidays are not excluded for this MVP.
4. Admin/lister attention means pending/packed and now >= dispatch_due_at; delivered/cancelled/dispatched are excluded. Unknown historical deadlines stay unknown. No automatic cancellation.
5. Show separate dispatch/transit/price to customers; verify changing a shop promise never changes an existing order's deadline, and payment retry never overwrites it.

Dispatch collection, transit collection, customer arrival estimates, overdue filter/red overdue cards are intentionally not activated against missing columns. No temporary cookie-only or description-field storage was substituted.

## Activity and deletion limits

The live schema has no meaningful-activity timestamp or refund state. Product/shop/order `updated_at` values cannot honestly establish overall last active or non-response. Admin order details show last order update; Live Listers shows outstanding preparation/dispatch work. No invented last-active date, 30-day inactivity flag or automatic deactivation.

Reliable activity needs an agreed definition/event collection and an approved schema proposal in a separate task. Automated deletion likewise needs explicit retention/anonymisation and session/fulfilment safeguards. Existing customer-order foreign keys cascade on deletion, making direct auth deletion unsafe. Manual reviewed requests cover MVP without that change. Refund state cannot be inferred from cancellation; admin UI says so.

## Signup investigation and dashboard checks

Read-only inspection of the configured test project confirmed both accounts appearing in repeated-signup logs were already email-confirmed. Auth logs on 10 October show `user_repeated_signup` at 16:51:43 and 17:00:28 UTC, a successful resend request at 16:52:47, and later successful password sign-ins. This supports reused-email behaviour for these attempts; it does not prove deliverability for a fresh address. No evidence from these attempts establishes SMTP failure or rate limiting. Codespaces link access affects opening links, not whether an email arrives.

App redirect generation points to the configured Codespaces `/auth/callback?next=/account` and preserves the existing PKCE exchange. Current local NEXT_PUBLIC_SITE_URL is the Codespaces URL. Before launch manually:

- Set deployment NEXT_PUBLIC_SITE_URL and Supabase Auth Site URL to the real HTTPS production origin.
- In Auth URL Configuration, allow the exact production callback and current development callback used by signup/reset flows. Inspect existing settings first; do not replace them speculatively.
- Verify Confirm email is enabled as intended and the signup template uses the existing compatible confirmation URL (standard `{{ .ConfirmationURL }}` for the current PKCE callback).
- Verify custom SMTP sender/domain credentials, delivery logs and Auth rate limits using a fresh email address. Supabase's built-in sender has restricted recipients/limits and is unsuitable for public launch; whether custom SMTP is configured was not exposed by the available tools.
- Test inbox/spam and provider delivery with a genuinely new address, then confirmation and sign-in in the same browser.

Sources: https://supabase.com/docs/guides/auth/auth-smtp ; https://supabase.com/docs/guides/auth/auth-email-templates ; https://supabase.com/docs/guides/auth/rate-limits ; https://supabase.com/docs/reference/javascript/auth-resend

## Manual browser checks

1. Admin: expand a lister with draft/pending/live/rejected/approved-hidden products. Verify stock and images, open each admin product view, confirm only pending submissions have moderation buttons; compare with the public storefront where drafts remain hidden.
2. Admin orders: each fulfilment filter, lister filter, full-order link, pagination, split-seller totals/items, tracking links, cancellation wording, and mobile widths. Customer/lister accounts must be denied admin routes.
3. Lister/customer orders: prepare, dispatch and deliver through existing controls; confirm text badges, subtle rectangles, exports and customer tracking still work.
4. New approved lister: welcome, Start, Back, Finish later, Escape, refresh and resume. Existing shop owners should never see it. Finish original onboarding and first-product review submission.
5. Shop delivery: free/own-price switching, save and reload, onboarding draft restore, existing delivery checkout totals in Stripe test mode.
6. Account deletion: wrong confirmation and unchecked acknowledgement keep the button disabled; valid confirmation opens email and does not change account/orders. Verify fallback address and support's manual identity/retention procedure.
7. Fresh-address signup, reused confirmed address, resend failure/rate limit, spam folder, confirmation callback, sign-in and password recovery. No registered-email disclosure.
8. Existing draft/publish/archive, stock preservation, bulk import and duplicate upload, product image navigation and Stripe test checkout/webhook remain launch regression checks.

## Deliberately deferred / post-launch backlog

- Back-in-stock “Notify me when it's back” and “Guess what… it's back!” emails: NOT implemented.
- Reliable activity/non-response tracking and inactivity review.
- Reviewed automated retention/anonymisation/account deletion.
- Refund visibility/integration after an agreed refund source of truth; no invented status.

## Verification

Final automated suite (outside sandbox for subprocess compatibility): 172 tests, 167 passed, 1 existing unrelated failure, 4 skipped. The failure is `tests/fulfilment-summary.test.mjs:72`: it expects `<FulfilmentSummary summary={fulfilmentSummary}>` in the lister dashboard, while the pre-existing dashboard uses summary-driven tiles. This batch did not change that dashboard. Four real-Postgres concurrency/integrity checks are skipped because their opt-in database test environment is not configured; no database test schema or migration was applied.

New tests verify the admin role gate runs before data access, split-seller item boundaries, filtered pagination, card text/status colours and complete catalogue pagination. The existing order/address/export tests pass after updating their render fixture for imports already used by the page and the new presentation helper. Stripe development safety checks pass outside the sandbox. Lint and `git diff --check` pass. Production build passes (the sandbox attempt compiled but could not parse its TypeScript subprocess configuration; outside-sandbox build succeeds).

Logs for this session: `/tmp/holyhub-launch-suite.log`, `/tmp/holyhub-launch-lint-final.log`, `/tmp/holyhub-launch-build-final.log`.
