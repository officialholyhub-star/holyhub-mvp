# HolyHub — release and developer handoff
Updated 12 September 2026.

## 1. Read this first

**The marketplace code is built and uploaded. It is not yet publicly deployed.**

The existing holyhub.co.uk landing site is a separate project and has not been replaced. The local preview is temporary and must not be exposed publicly or used for real personal information.

| Item | Location / status |
| --- | --- |
| Complete source | [Review branch](https://github.com/officialholyhub-star/holyhub-mvp/tree/codex/full-marketplace-mvp) |
| Review and automated checks | [Pull request #1](https://github.com/officialholyhub-star/holyhub-mvp/pull/1); Alea's officialholyhub-star account has been requested to review |
| Public marketplace link | **Not available yet** — do not use the existing landing URL as proof the marketplace is live |
| Eventual marketplace address | app.holyhub.co.uk; preserve root/www and email DNS |
| Local review | http://127.0.0.1:3100 — empty, temporary test backend, no real email or payments |
| Latest verified application baseline | 77d20e3: 49 automated checks and GitHub Actions passed; the later release-gate pass adds two checks |
| Current access blocker | Browser connection times out; alternate helper fails during startup. No Supabase/Vercel deployment credentials are configured in the task environment |

**Do not rebuild the app.** Continue from the review branch, not the old main branch or an older ZIP. Keep the original logo, supplied Deepgrids Sans and **Connect. Discover. Grow.**

## 2. What people can do once the real backend is connected

- Create and confirm an account, log in, recover access and update their profile.
- Apply as a Christian business; an administrator reviews the application.
- Prepare products and images; publish only after business approval.
- Browse approved businesses and products, search/filter and visit a brand's website.
- Discover public events and follow organiser links.
- Administrators create, edit, publish and archive events, moderate businesses/products and review recorded activity.

Business edits return to review. Event edits return to draft. Visitors cannot curate events or edit another person's listings. The catalogue starts empty; no fake businesses, products or events are added by production migrations.

Basket, order, finance and refund screens exist, but **checkout and actual money movement do not work and must remain disabled**. No customer should be told a payment or refund has occurred.

## 3. The shortest safe route to a public link

A working public link needs both the web host and the real Supabase backend. Namecheap is **not** the current blocker: a host-issued HTTPS address can be used first.

1. **Restore named-account access.** Alea grants the developer access to the intended Supabase and hosting projects. GitHub access is already working. Use invitations and private project settings, not shared passwords or secrets in chat.
2. **Inspect the database before changing it.** The configured project is `mgzsxzixobyfdlutxtgs`. Its readiness function still fails; email signup and required confirmation are enabled, but delivery is untested. Run [inspect-existing.sql](supabase/ops/inspect-existing.sql), review any existing data/schema and agree a backup/migration plan. Never reset the project or blindly replay old migrations.
3. **Apply reviewed schema changes.** A confirmed fresh project needs migrations 001–008 once, in order. An existing compatible installation already at 007 needs only 008. Do not run anything from tests/fixtures in production.
4. **Set up email and the verified owner.** Configure real SMTP, confirmation/recovery URLs and secure email change. Connect the normal development app to the real project, have the owner confirm their own account, then use [bootstrap-admin.sql](supabase/ops/bootstrap-admin.sql) with that account's Auth UUID. The detailed first-deployment sequence is in [PRODUCTION_LAUNCH.md](PRODUCTION_LAUNCH.md). Never promote an unverified account.
5. **Complete the agreed hosting path.** The current Next.js/Node build has Vercel configuration. A Vercel project URL can be shared without Namecheap after real acceptance checks. The requested GPT Site is a different runtime and still needs a compatible server build and safe image-processing solution; uploading this Node build or a static copy will not work. Agree any host change with the owner.
6. **Verify before sharing.** Set the chosen public URL in the app and Supabase's allowed URLs. The production build now checks hosted readiness before compilation and stops on failure. Then complete the real-user checklist below. Add app.holyhub.co.uk afterward if desired.

No hosted migrations, DNS changes, infrastructure purchases or production deployment have been performed during this handoff work. Browser startup failed again during the final publishing attempt; no account settings were changed.

## 4. Real launch acceptance — all must pass

- [ ] Reviewed source and latest GitHub checks pass.
- [ ] Hosted schema, private image storage and verified active administrator are ready.
- [ ] An owner-controlled test user receives confirmation and recovery emails, including cross-device use.
- [ ] A new user submits a business, the administrator approves it, and the seller uploads/publishes a product.
- [ ] A signed-out visitor discovers that product; another account cannot change it.
- [ ] The listing and photo remain after sign-out, refresh and redeployment.
- [ ] An administrator publishes an event; draft/archived events remain hidden and ordinary users cannot curate them.
- [ ] If enabled, actual Turnstile verification works for signup/login/recovery and retry after an error.
- [ ] Phone and desktop journeys work on the actual HTTPS address.
- [ ] Privacy/operator details, moderation responsibility, backups including images, restore procedure and monitoring are approved.
- [ ] Test listings are unpublished; demo/sample/payment flags stay off.
- [ ] The verified public URL is recorded in this guide and sent to Alea.

A passing build or health endpoint is not proof of email delivery, all permissions, backups or a finished payment system.

## 5. Progress against the original ten stages

**Four built locally, five partial, one optional stage not started.** “Built locally” is not production sign-off.

| Stage | Status | Remaining |
| --- | --- | --- |
| 1. Foundation/accounts/security | Built locally | Hosted Auth/SMTP, live security checks and operational setup |
| 2. Lister applications/storefronts | Built locally | Verified live admin and real application/approval acceptance |
| 3. Products/discovery | Built locally | Hosted Storage and first real publication/persistence checks |
| 4. Basket/checkout | Partial | Stripe sessions, stock reservation/expiry, delivery/tax rules and payment tests |
| 5. Orders/payouts/commission/reserves | Partial | Connect onboarding, real money movement, reconciliation, reserves/releases and fee collection |
| 6. Refunds/appeals | Partial | Provider refunds, balance/reversal reconciliation, retries and approved appeal policy |
| 7. Administration | Partial overall | Live owner/admin setup and future financial integrations; non-payment admin controls are built |
| 8. Events directory | Built locally | Hosted migration and verified real event content; dates/cancellations need a human maintainer |
| 9. Bible | Not started; optional | Owner decision and appropriately licensed content |
| 10. Final verification | Partial | Hosted providers, real devices, operational security, restore rehearsal, monitoring and future payment tests |

Events support written recurring schedules, not automatic occurrences or ticket sales. Optional CAPTCHA is coded but must be enabled on both the app and Supabase; its browser tests use a provider stand-in.

## 6. Financial decisions only Alea should make

Confirmed commercial figures remain **10 free product listings, 20p per additional listing and 5% commission**. They are not an active payment integration. Extra products remain blocked by the current allowance/fee boundary; there is no silent waiver.

Still decide: lifetime vs active/first-published allowance, one-off vs recurring listing fees, reserve percentages/periods, shipping and tax, appeal windows/limits, and who bears refunds/disputes/payment costs. Implement and test financial stages separately before enabling them.

## 7. Developer entry points

Use Node 24 and the existing lockfile. Clone the review branch, run `npm ci`, then `npm run demo` for an empty local review. This mode loses data on restart and must never be published. Use README's real-development configuration to connect actual Supabase.

- [DEVELOPER_HANDOFF.md](DEVELOPER_HANDOFF.md) — architecture, file map, access, security boundaries and operational details.
- [PRODUCTION_LAUNCH.md](PRODUCTION_LAUNCH.md) — ordered database/email/admin/hosting steps and acceptance checks.
- [BUILD_STATUS.md](BUILD_STATUS.md) — feature and financial limitations.
- [README.md](README.md) — setup, commands, authentication templates and configuration.
- [.env.production.example](.env.production.example) — public configuration names and disabled-mode flags; never put privileged secrets into NEXT_PUBLIC values.

The latest suite contains **40 database/validation/configuration checks and 11 browser journeys**. The application baseline passed lint, types, production-mode compilation and GitHub CI; use PR #1's latest commit checks for the release-gate update. The configured production command additionally verifies real services and must not be bypassed.

**Next action:** regain project access, safely finish Supabase/email/admin setup, and publish through the agreed compatible host. The source and guides are ready for that work; public launch is still pending.
