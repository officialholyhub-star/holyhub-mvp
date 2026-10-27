# Signup completion fix — 14 October 2026

Scope: completion celebration and removal of the specified onboarding helper paragraph only. No auth action, database, preference, selection, Account, or reminder behavior changed. No deployment or database writes.

## Diagnosis and limits

The original implementation used three independent clocks: confetti started in a requestAnimationFrame and was removed after 2.4 seconds, the parent navigated after 3.2 seconds, and CSS faded the welcome to opacity zero at 3.2 seconds irrespective of whether navigation had committed. It called `router.push(destination)` and immediately `router.refresh()`, issuing a refresh while navigation was starting. The prior browser fixture mocked both router functions and never loaded a real destination, so it could not verify these interactions.

An actual Next.js dev-server reproduction with a local fake auth service showed the original compiled confetti did render and fall. The first run was still on `/auth/signup` approximately 4.7 seconds after the welcome appeared, beyond the unconditional fade. A longer baseline run showed marketplace eventually loaded, including two GETs. Thus a permanently cancelled navigation or complete particle-rendering failure was **not** established. The confirmed defect is independently fading the success UI before route loading completes, compounded by short, low-contrast confetti and separately scheduled clocks. The user's exact complete absence of confetti was not reproduced; it must not be presented as a proven CSS compilation or auth failure.

## Changes

- `components/customer-onboarding.tsx`: removes the specified helper paragraph with no replacement; owns celebration and navigation together inside `CustomerWelcome`; waits for two animation frames before starting its display clock; removes particles at 3.1 seconds and initiates navigation at 4.2 seconds using one `router.replace(destination)` with no immediate refresh. Both requested text lines stay visible until navigation commits. Continue remains usable.
- `components/customer-onboarding.module.css`: removes the unconditional timed departure/fade; makes confetti larger (9×16px), doubles it to 84 pieces, strengthens HolyHub blue/pink/gold contrast, and staggers it across the viewport over 605ms. Each piece falls from above the viewport for 2.4 seconds (last piece finishes at about 3 seconds). Confetti never intercepts input. Reduced-motion mode omits falling particles and disables welcome-content animation.
- `tests/customer-onboarding.browser.mjs`: updates the router fixture to support replace, waits for the painted falling state and checks 84 particles.
- `tests/customer-welcome.real-browser.mjs`: new integration test runs the actual Next.js server, compiled CSS, signup Server Action, cookie handling and router. It copies source into a temporary directory, excluding real environment files, and points auth/API calls at a loopback-only fake service. It never invokes live Supabase, persists accounts or changes the database. It verifies retry, both success texts, full-screen bounds, particles actually moving down the screen, completion visibility, minimum display time, reduced-motion absence of animation and real destination URLs. A deliberately delayed marketplace response tests that welcome remains visible while routing is pending.

## Verification

- `npm run lint`: passed.
- `npx tsc --noEmit --incremental false`: passed.
- `node tests/customer-signup.test.mjs`: passed.
- `node tests/customer-onboarding.browser.mjs`: passed at 320/390/768/1440px, including existing selection, skip, account edit, signup/retry and confirmation behavior.
- `node tests/customer-welcome.real-browser.mjs`: passed at 390/1440px in normal and reduced-motion modes; actual routing reaches marketplace for session signup and check-email for confirmation signup. The tests exercise an unsuccessful signup followed by success in all four cases.

Screenshots of actual Next pages are in `docs/screenshots/welcome-fix-2026-10-14/`: `welcome-{390,1440}-{no-preference,reduce}.png` and `complete-{390,1440}-{no-preference,reduce}.png`. These supplement the earlier component-fixture screenshots.

Rerun the real browser test with Playwright installed under `/tmp/holyhub-onboarding-tools`, or set `HOLYHUB_BROWSER_TOOLS_DIR`. The temporary Next server uses port 3100 by default; set `HOLYHUB_WELCOME_TEST_PORT` to change it. The normal development server and environment files are untouched.
