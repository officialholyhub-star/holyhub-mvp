# Customer onboarding — 14 October 2026

Implemented locally. No production deployment, live signup, database write, or migration application was performed.

## Files

- `app/auth/signup/page.tsx`: renders the customer flow.
- `app/auth/actions.ts`: reuses Supabase signup; returns safe validation/results to the client; signup passwords require 12–128 characters. Existing login and recovery behavior is preserved.
- `components/customer-onboarding.tsx` and `.module.css`: three screens, selection states, navigation, signup fields, welcome and motion accessibility.
- `components/password-input.tsx`: optional controlled input and maximum-length props, preserving existing callers.
- `lib/customer-onboarding.ts`: guarded session-only participation flags, keyed to authenticated user ID.
- `components/customer-setup-reminder.tsx`, `components/site-header.tsx`: authenticated, dismissible reminder.
- `app/account/setup/page.tsx`: protected optional setup revisit, without duplicate signup.
- `tests/customer-signup.test.mjs`, `tests/customer-onboarding.browser.mjs`: server validation and real component browser tests with mocked auth/navigation.
- This document: limitations, future schema requirements, manual tests and visual description.

## Implemented behavior and visuals

1. **Interests / 1 of 3:** white rounded panel, blue progress bars, exact requested heading/helper and eight cards. Cards stack on mobile and form two columns on desktop. Selected cards have a pale blue background, blue outline, tick and small lift. Continue is disabled with a polished muted state until at least one choice is selected; no validation error is shown. Skip clears the selection and advances without an answer.
2. **Faith journey / 2 of 3:** exact heading/helper, six single-select cards in one column, including “Prefer not to say.” Back, Continue and Skip remain available. Native radio controls support keyboard selection. No answer is required.
3. **Join / 3 of 3:** first name, email, password, confirmation, separate required Customer Terms/Privacy acknowledgement and optional unticked marketing checkbox. Existing `/terms` and `/privacy` pages are used. The UI explicitly says subscriptions are unavailable and the checkbox does not save a preference or subscribe anyone. Back retains typed values and checkboxes; validation errors retain the form.

Step changes have short directional slide/fade entrances, cards have a small stagger and selection micro-animation. Reduced-motion mode removes animations and selection movement. Heading focus moves with steps. Welcome displays “Welcome to HolyHub 💙” and “Connect. Discover. Grow.” in a full-screen pale-blue welcome with 42 small CSS confetti pieces falling from the viewport top for up to 2.3 seconds. After 3.2 seconds it navigates to marketplace with an immediate session, otherwise check-email. Reduced motion omits the falling pieces and retains the same readable welcome duration. A Continue link is available immediately.

The small top-left reminder appears for logged-in users whose current tab has incomplete optional setup. Dismiss and Continue setup suppress it for that tab's session across route changes/reloads. Continue setup opens the first unanswered optional step. Existing users keep normal access. The permanent Account entry “Personalise HolyHub”, with supporting text “Update what you’re interested in and finish your HolyHub setup.” and “Edit preferences”, opens `/account/setup?edit=1` at Screen 1 even when completed or dismissed. No previous answers are prefilled because they are not persisted. Returning users complete only optional questions, then return to account; they never create another account.

The suggested “Help us tailor what you see” copy was replaced with truthful temporary-state wording because no personalisation exists.

## Deliberate limitations / privacy decisions

- No approved special-category collection implementation was found in repository migrations/auth/profile code. Faith answers **and interests that may imply religious beliefs** exist only in component memory. No answer is stored in cookies, browser storage, Supabase, auth metadata, URLs or logs. They are cleared after successful signup/setup or when leaving the component. No profiling or personalisation is implemented.
- Only boolean participation flags (`interests`, `faith`) and dismissal state are placed in sessionStorage for an authenticated user. These are not durable profile-completion records and never gate checkout or permissions. Browser storage denial falls back to normal use; dismissal is retained in the mounted component, but cannot be guaranteed across reloads if the browser forbids storage.
- Confirmation-required signup preserves check-email/PKCE behavior. No progress is attached to the unauthenticated/possibly obfuscated signup user ID. After later confirmation/login, optional setup starts from step 1. Progress does not follow users across tabs, devices or fresh sessions.
- Marketing evidence, email subscription processing, unsubscribe and preference management are not implemented in the existing system. The checkbox is presentation-only with an explicit disclosure. No marketing flag is sent to the signup action or auth metadata.
- Existing terms acknowledgement was a required input without durable versioned evidence. This change preserves that behavior; it does not pretend to implement evidence storage.
- Login retains compatibility with existing passwords. Password reset retains its existing eight-character rule; only new account creation is changed by this request.
- No basket/checkout rules were changed. Checkout still uses authenticated active-account checks, product/stock/delivery validation and Stripe payment/shipping; it never reads onboarding flags or answers.

## Schema work

**No migration is needed for the implemented memory/session-only UI. There is no migration to apply.** `profiles.full_name` and the existing new-user trigger already support first name. No new profile columns or auth metadata keys were added.

For a separately approved durable implementation, recommended fields are:

| Future record / field | Why it is needed | Security / privacy requirement |
| --- | --- | --- |
| `customer_setup.user_id uuid` (PK/FK to profiles, cascade delete) | Own the setup record | RLS restricts reads/writes to the account owner; narrow grants; no checkout dependency |
| `customer_setup.interests_step_completed_at timestamptz null` | Resume an unanswered interests step | Record participation only; no assumption that content is personalised |
| `customer_setup.faith_step_completed_at timestamptz null` | Resume optional faith step | Do not require faith answers; skip/decline remains possible |
| `customer_setup.updated_at timestamptz` | Track setup edits | Server-issued timestamp, defined retention |
| `marketing_consent_events.id uuid`, `user_id uuid`, `decision text` (`opt_in`/`withdrawn`), `recorded_at timestamptz`, `wording_version text`, `source text` | Versioned evidence and withdrawal history | Append-only server writes; users cannot forge evidence; strict access; separate from legal acknowledgement |
| `email_subscriptions.user_id uuid`, `status text`, `provider_reference text null`, `updated_at timestamptz` | Actual subscription/withdrawal processing | Reliable retry/outbox integration, no activation before valid opt-in, account deletion handling |
| `customer_legal_acknowledgements.user_id uuid`, `terms_version text`, `privacy_version text`, `acknowledged_at timestamptz`, `source text` | Evidence of the actual legal acknowledgement | Server records the served wording/version; separate from marketing; retention reviewed |

These would require a new reviewed migration and application wiring, neither supplied as a ready-to-apply migration because the legal wording/version, retention, provider and evidence design have not been approved. No database changes are required to review or use the current UI.

Do **not** add a faith-answer field yet. Before storing religious-belief answers or faith-related interests, the owner must approve the purpose, applicable lawful basis and special-category condition, notice/collection language, minimisation, access, retention, deletion and withdrawal handling. This implementation chooses no legal basis. If approved later, use a separate restricted record, never editable auth metadata as authorization, and never a mandatory account/transaction field.

## Automated verification

Commands:

```sh
npm run lint
npx tsc --noEmit
npm run build
node tests/customer-signup.test.mjs
node tests/customer-onboarding.browser.mjs
```

Validation passed: production build, full repository lint, TypeScript, server signup tests, and browser flow tests at 320/390/768/1440px, including signup-error retry with retained checkboxes, confirmation destination, and existing-user setup. Checkout and live email delivery remain staging/manual checks.

Browser test tooling is installed outside the project at `/tmp/holyhub-onboarding-tools` (Playwright/esbuild); no application dependencies changed. Set `HOLYHUB_BROWSER_TOOLS_DIR` to a directory containing those packages to rerun elsewhere. Screenshots are written to its `results` directory. Browser auth and navigation are mocked; tests do not create accounts or payments. Actual email deliverability and real Stripe purchases require manual staging verification.

## Exact manual test steps

Use `npm run dev` and a configured development/staging Supabase project; never use production credentials for these account/payment tests.

1. Open `/auth/signup` at 390px wide, then desktop. Check 1 of 3 and all eight exact options. Select two cards: both stay selected, show ticks and lift subtly. Continue, choose any faith option, Continue: check 3 of 3 and Join HolyHub.
2. Repeat, skipping Screen 1 only, Screen 2 only, then both. Each reaches account fields without a validation requirement on optional questions.
3. Select “Prefer not to say,” then another faith option: exactly one radio remains selected. Navigate Back/Continue and confirm interest and faith selections remain while the component is mounted.
4. On Screen 3 confirm marketing is unticked. Fill first name and email, enter matching 12-character passwords, tick only legal acknowledgement. Submit: no marketing is required. Repeat with marketing ticked: disclosure must remain visible; no subscription or stored preference should be claimed.
5. Enter an 11-character password: browser blocks submission. Send an 11-character or over-128-character value directly to the action: server rejects it. Try mismatched confirmation and missing legal acknowledgement: errors appear; no account is created. Correct errors and retry.
6. Fill account details, tick legal acknowledgement, Back then Continue: values/checkboxes remain. Verify Terms opens `/terms` and Privacy opens `/privacy`.
7. With email confirmation enabled: submit a fresh staging email, see the welcome transition, then check-email. Follow the confirmation email in the same browser, confirm account access and existing resend/login paths. Optional completion resets after confirmation as disclosed.
8. With staging confirmation disabled: complete all screens, see welcome then marketplace; no incomplete reminder in that tab. Create a second account with one/both optional steps skipped: the reminder appears at top left after account navigation.
9. Dismiss reminder, visit marketplace/events/account and reload: it stays dismissed in that tab. Start a fresh session: it may reappear because completion/dismissal is session-only. Another user's flags must not affect this account.
10. With interests incomplete, Continue setup opens Screen 1; with only faith incomplete, it opens Screen 2. Select or skip, continue: return to account without any signup fields. Completing or leaving setup does not block ordinary use.
11. Log in with an existing account, including an existing shorter password: login remains available, only the optional reminder appears; no forced onboarding redirect occurs.
12. With optional questions skipped, browse marketplace/events, add a purchasable product to basket and proceed through a Stripe **test-mode** purchase using needed shipping details. Verify no interest/faith questions appear in the transaction path. Confirm order success as in the existing checkout regression process.
13. Emulate `prefers-reduced-motion: reduce`: no card/step animation, controls and welcome Continue remain usable. At 320/390/768/1440px confirm no horizontal overflow. Tab through controls; radio arrow keys select options; headings receive focus after navigation.
14. Inspect browser network payloads, sessionStorage, console and server output while selecting answers/submitting. Answers must not occur in requests or logs; storage contains only participation/dismissal booleans. Marketing must not occur in signup metadata. Deny browser storage and confirm signup/browsing still work.

## Proposed interest preferences (no migration or persistence implemented)

Future interests should live in an owner-scoped `public.customer_preferences` record, separate from auth metadata: `user_id uuid` (primary key referencing profiles), `interests jsonb` with `{ "version": 1, "interestIds": ["events", "community"] }`, and server-issued `updated_at timestamptz`. An empty ID array represents the default experience. Validate IDs against `interestDefinitions` in `lib/customer-onboarding.ts`, apply owner-only RLS, and define retention/deletion before wiring a persistence adapter. `CustomerInterestPreferences` supplies the proposed typed payload; today selection state remains component memory only. No actual database table/field has been created.

| Interest | Future emphasis |
| --- | --- |
| Discover Christian brands | Marketplace |
| Support Christian businesses | Marketplace and new brands |
| Find Christian events | Events |
| Find community | Community |
| Discover churches & organisations | Organisations |
| Find opportunities / volunteering | Opportunities |
| Grow in my faith | Faith, Bible and community |
| Just explore | Balanced/default |

This is documented metadata, not implemented recommendations. Future preferences may change emphasis/order only; every user must retain full platform browsing and eligibility. The faith-journey answer must never enter this record, mapping, logs, analytics, or auth payload. Permanent storage/use requires a separately approved special-category processing decision; none is implemented here.

The UX fix adds/updates `app/account/page.tsx`, `app/account/setup/page.tsx`, `components/customer-onboarding.tsx`, `components/customer-onboarding.module.css`, `lib/customer-onboarding.ts`, both onboarding/signup tests, `tests/account-page.test.mjs`, `tests/password-reset.test.mjs` (signup result assertion), `tests/dispatch-proposal.test.mjs` (missing existing fee-helper mock), and this document. Existing in-progress signup/header/password changes are retained.

## Final UX-fix verification

- `npm run lint`: passed with no warnings after final effect dependency correction.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed (33 static pages and all dynamic routes generated).
- `node --test tests/*.test.mjs`: 233 tests, 229 passed, four skipped, zero failures.
- `node tests/customer-onboarding.browser.mjs`: passed at 320/390/768/1440px, including disabled/enabled Continue, zero-selection skip, back/retry retention, server payload exclusion, session boolean-only storage, full-screen welcome text, non-blocking falling confetti, confetti completion before navigation, reduced-motion welcome without particles, check-email destination and permanent account entry/edit after completion/dismissal. Auth/router and account data are mocked; no live signup or database writes.
- Two existing dispatch proposal fixtures needed the already-used Stripe fee helper mocked; payment code was unchanged. The recovery suite’s signup assertion now checks the successful action result required by the visible welcome, while preserving its login redirect assertion.
- Screenshots from the real components with mocked data are in `docs/screenshots/onboarding-2026-10-14/`: `disabled-continue`, `account-preferences`, `welcome`, and `confetti`, each at 390px and 1440px. Browser fixture module styles use original class names; account screenshots load account-only module CSS to avoid fixture class-name collisions.

No deployment or database migration was applied. No new permanent answer storage exists. Existing account credentials/name persistence through normal signup remains unchanged; sessionStorage contains only participation and dismissal flags.
