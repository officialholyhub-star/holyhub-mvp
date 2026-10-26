# C2 admin TOTP MFA — staging implementation

Branch: `alea/stage4-payments`. No deployment, domain, Stripe, remote Auth configuration, or remote database changes are part of this implementation.

## Enforcement and audit

The original shared guard checked authenticated user, active profile and database role membership, but accepted AAL1. All existing admin pages (`/admin`, orders, products, listers, applications, analytics, payments) and all four mutation entrypoints already call `requireRole("admin")` before queries or privileged clients. That shared guard now also requires server-validated AAL2 with TOTP authentication evidence and a currently verified TOTP factor. `/admin/security` uses the same guard. Stripe webhooks remain signed provider operations; customer/lister actions keep their existing role and ownership boundaries.

`getAdminMfaState` reads the cookie token, then passes it explicitly to `getAuthenticatorAssuranceLevel(token)`. In installed auth-js, that overload validates the token remotely through `getUser(token)`; the no-argument overload merely decodes the local token. `listFactors()` retrieves factors from Auth, independently of cookie user data. Missing sessions/API failures fail closed. No user metadata or client boolean authorizes admin access. The TOTP AMR names accepted are `totp` and `mfa/totp`; other second factors alone do not grant admin access.

The separate `requireAdminMfaIdentity` bootstrap helper checks authenticated user, active account and admin database role, and is used only by the MFA pages/actions. It must never be used for admin data or mutations. Customers/listers are rejected from this bootstrap flow and their ordinary pages never invoke MFA checks.

The proxy overwrites `x-holyhub-request-path` with the actual path/query. The guard uses it only for navigation. `adminNextPath` reuses `safeInternalPath`, normalizes the URL, and limits destinations to `/admin` or its descendants. The setup/challenge actions sanitize `next` again. Missing/spoofed paths cannot authorize access. An admin action denied at AAL1 is not replayed after MFA: the user returns to its page and must explicitly resubmit it.

## Enrollment and challenge

An AAL1 admin without a verified TOTP factor goes to `/auth/mfa/setup`. Enrollment starts only from an explicit POST server action, never during rendering or prefetch. Supabase supplies a QR data URL and manual key to that authenticated admin's transient client state. Neither is sent to a QR service, placed in a URL, logged, or written to application storage. Refreshing the page loses that enrollment display.

AAL1 with an existing verified TOTP factor goes to `/auth/mfa/challenge`. Users can choose any verified TOTP factor, including a backup. Each submitted code creates a new Auth challenge. Wrong/invalid codes fail without admin access; Supabase's rate limits remain authoritative. Factor IDs are checked against the current user's server-fetched factor list. Unverified backup factors cannot be verified at AAL1 when an existing verified TOTP factor is present.

Successful `mfa.verify()` stores the upgraded access/refresh tokens through the existing SSR cookie adapter. There is no redundant refresh-token rotation: auth-js verify already updates the session. The server rechecks the new session assurance and factors before redirecting. The destination guard independently verifies them again. Logout followed by password login produces AAL1 and requires another challenge.

## Backup and recovery — founder review required

Use **Admin → Account security → Add a backup authenticator**, or `/admin/security`. Adding/verifying a backup through the app requires a TOTP AAL2 session if an existing verified TOTP factor is present. Enroll a distinct factor on a separate securely held device; verify it before considering it a backup. Confirm a fresh password login can challenge the backup while the primary remains available. Keep at least two founder-approved admin operators with independently protected devices. Do not share accounts or put setup keys in tickets, screenshots, chat, or repository files.

The app implements no factor deletion, recovery codes, skip flags, metadata overrides, or automatic service-role factor removal. Do not assume recovery-code support is available/configured in this staging project; it is outside this implementation.

Proposed manual lost-all-devices procedure (requires founder approval before operational use):

1. Open a restricted incident record without codes/secrets. A founder and a second authorized operator verify identity through previously established independent channels and existing records. An email, password reset, or support message alone is insufficient. If identity cannot be established, keep access blocked and escalate to Supabase support through the organization owner.
2. Confirm the exact project and user ID. For staging, this must be `holyhub-stage4-test`; never use a production project accidentally. A different MFA-protected administrator/operator temporarily removes only the affected user's admin membership, preserving unrelated roles, and records the change. Do not disable RLS/MFA or elevate another unverified account as a shortcut.
3. Revoke the affected user's sessions through approved Supabase operator tooling. Invalidate refresh sessions and wait at least the project's maximum access-token lifetime plus clock skew after revocation before proceeding: already issued JWTs are not instantly invalidated by sign-out. Investigate suspicious changes and secure the user's email and credentials using normal account-recovery controls.
4. Only after the identity review and containment, two authorized operators may approve manual deletion of lost factors through Supabase's authenticated organization-owner tooling. Record factor IDs and the approval, never secrets. Removing the final factor is a break-glass operation, never routine support. Do not add an application endpoint or service-role automation for this procedure.
5. During a supervised recovery window, restore the verified user's original admin membership. Have them log in with their secured credentials, enroll and verify a new TOTP factor, confirm AAL2 access, then add/verify a separate backup. Until verification, the application and the C2 RLS migration deny admin capabilities. If enrollment is not completed, remove admin membership again and revoke sessions.
6. Confirm fresh login with each new factor, revoke any remaining old sessions, review Auth/audit logs and admin changes, and close the incident with founder sign-off. Do not delete a healthy final factor during ordinary device replacement; add and test the replacement first.

## Database hardening and release boundary

Existing RLS admin branches use `private.has_role('admin')` without assurance. The prepared migration `20261026230750_c2_admin_aal2.sql` adds signed JWT AAL2/TOTP requirements to that branch while preserving the membership predicate, function privileges, customer/lister behavior, and own-role reads needed for MFA bootstrap. It retains the existing security-definer helper with an empty search path; no new privilege surface is introduced.

**The migration is not applied to any remote database.** Until a separately authorized staging rollout applies it, existing direct Supabase Data API admin policies remain role-only, even though the changed application guard enforces MFA. Do not claim C2 is active on the hosted staging site before both code and migration are rolled out and real staging acceptance is completed. Do not batch-push the repository's unrelated pending migrations. A staging operator must inspect the deployed helper/policies and migration history, apply only this reviewed change through the approved workflow, run security advisors, and verify AAL1/AAL2 behavior. Production rollout requires separate authorization.

The migration follows the project's current shared role-helper design. Any future admin RLS policy/RPC must use it or explicitly enforce equivalent AAL2 checks; any new app admin entrypoint must call `requireRole("admin")` before access. Service-role/backend workers bypass RLS by design and remain outside end-user authorization; do not expose those helpers as unguarded actions.

## Verification and remaining limits

Automated coverage includes real application guards/actions with injected Auth responses, a disposable real Postgres RLS regression, and a local Next.js browser fixture with SSR cookies/server actions. Local fixtures are not proof of the hosted Auth configuration. Real staging TOTP enrollment with an authenticator device, project rate limits, revocation timing, backup login, email confirmation and password recovery should be exercised by an authorized staging admin after rollout. No real admin credentials or TOTP secrets were used by these tests.

Abandoned unverified enrollments are deliberately not removed automatically; repeated abandoned setup attempts can reach the project's factor limit. A verified operator should review only stale unverified factors manually if this happens, preserving verified factors. Supabase factor-management APIs remain user-accessible according to its Auth configuration; the app itself never removes factors. Existing XSS/session-token theft risks and organization-owner security remain separate controls. A previously elevated session follows Supabase token/session lifetimes; this change adds no custom session-expiry policy.

API references: [Supabase TOTP enrollment/challenge](https://supabase.com/docs/guides/auth/auth-mfa/totp), [server-side AAL API](https://supabase.com/docs/reference/javascript/auth-mfa-getauthenticatorassurancelevel). Installed Next.js authentication, server-action and proxy guides were read before implementation.

## Changed files

- `lib/auth/require-user.ts` — shared admin guard and restricted MFA bootstrap helper.
- `lib/auth/admin-mfa.ts` — validated assurance/factor state and safe admin destinations.
- `lib/supabase/proxy.ts` — trusted current-path forwarding for return navigation.
- `app/auth/mfa/actions.ts` — authorized enrollment, challenge and verification.
- `app/auth/mfa/mfa-form.tsx` — QR/manual key, factor selection and code entry.
- `app/auth/mfa/setup/page.tsx`, `app/auth/mfa/challenge/page.tsx` — guarded MFA pages.
- `app/admin/security/page.tsx`, `app/admin/page.tsx` — backup setup access; only the security link is changed on the existing dashboard.
- `supabase/migrations/20261026230750_c2_admin_aal2.sql` — prepared RLS hardening.
- `tests/admin-mfa.test.mjs`, `tests/admin-mfa-database.test.mjs`, `tests/admin-mfa.browser.mjs`, `tests/public-storefront-auth.test.mjs` — guard/action, SQL, browser and path-header verification.
- `docs/c2-admin-mfa.md` — this implementation/recovery/release record.

## Checks performed

- `npm run build`: passed, including Next.js compilation, TypeScript and route generation.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `node tests/admin-mfa.test.mjs`: 16 passed.
- `node tests/public-storefront-auth.test.mjs`: 3 passed, including spoofed return-path overwrite.
- `HOLYHUB_MFA_TEST_CONTAINER=holyhub-c2-mfa-postgres node tests/admin-mfa-database.test.mjs`: 1 passed against a disposable local Postgres 17 container. The test creates the existing foundation/application policies, applies C2, tests real SELECT/UPDATE RLS behavior, then rolls back.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/holyhub-c2-browsers node tests/admin-mfa.browser.mjs`: passed against a temporary copy of the real app and loopback Auth fixture, including QR/manual key, bad code, session upgrade, backup, logout/password-login challenge, direct analytics navigation, post-MFA analytics rendering, customer/lister AAL1 pages and non-admin denial. Browser tooling lives in `/tmp`; `HOLYHUB_MFA_BROWSER_TOOLS` can select another Playwright installation.
- `node tests/password-reset.test.mjs`: 11 passed; signup/confirmation-branch/safe-login regression (`node tests/customer-signup.test.mjs`) passed.

The wider suite has unrelated failures in `empty-states.test.mjs` (existing prepared/live copy mismatch), `friendly-errors.test.mjs` (existing storefront test calls the page without its searchParams argument), `manual-qa-cleanup.test.mjs` (existing loader looks for `components/lister-activation.ts` rather than `.tsx`), and `stripe-development.test.mjs` (child-process TEST-output assertion in this environment). Their implementation files were not changed by C2. These were left outside this security fix. Optional database suites are not live-project checks.
