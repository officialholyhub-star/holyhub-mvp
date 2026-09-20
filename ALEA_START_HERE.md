# Alea — HolyHub handoff
Updated 20 September 2026.

## Open the working marketplace

**Public link:** [HolyHub Marketplace](https://holyhub-marketplace.matthewjeanty6.chatgpt.site)

The existing **holyhub.co.uk** landing site is unchanged. An older Deepgrids ChatGPT Site was reused; no new Site slot was consumed. Its previous version remains recoverable.

**Production source:** [sites/ in the review branch](https://github.com/officialholyhub-star/holyhub-mvp/tree/codex/full-marketplace-mvp/sites).
**Technical handoff:** [sites/SITES_HANDOFF.md](sites/SITES_HANDOFF.md).
**Review:** [PR #1](https://github.com/officialholyhub-star/holyhub-mvp/pull/1).

The repository root also contains the earlier Next.js/Supabase marketplace, now with the combined design. It is retained, not deleted, but it does **not** run the public Sites link. Do not start deploying the root app assuming it uses the same accounts/database.

## What customers and listers can do

- Browse real approved businesses, published products and events without signing in.
- Sign in with a **ChatGPT account**, create a HolyHub profile and submit a business application.
- Prepare product drafts, descriptions, GBP prices, quantities, delivery information and up to five photos.
- Publish after a human administrator approves their business.
- Edit or archive products; business-profile changes return the business to review.
- Receive application review notes in their account.

The database and photo storage are persistent. There are **no fake public listings**. An empty collection means the community is ready for its first real businesses.

## What is not switched on

No HolyHub checkout, Stripe, listing charges, commissions, payouts, loyalty or monetary refunds. Customers contact a business or organiser through its own website. The Hub is a discovery starting point—not a community chat or Bible reader. Notifications are currently in-account, not signup email alerts.

This is the functional **non-payment discovery MVP**, not all ten stages of the original commerce PRD. Do not announce payments or describe the incomplete financial stages as finished.

## Running HolyHub

1. Sign in through **Join HolyHub**.
2. The initial administrator is Matthew's ChatGPT account, **matthewjeanty6@gmail.com**. Open **My account → Open administration**.
3. Alea should share her exact ChatGPT account email with the Site owner. The owner adds it to the private administrator allowlist and redeploys. GitHub access alone does not grant administration.
4. Review each business and website before approval. A review message is sent to the applicant's in-account updates.
5. Use administration to hide inappropriate products, suspend accounts, and create/review/publish events.
6. Test your own real application and photo flow before inviting a large group. Do not add fictional businesses to the production catalogue.

## Ownership, branding and code

The original supplied logo and **Connect. Discover. Grow.** slogan remain. Deepgrids Sans is locally hosted. Alea's SVG icons and warmer Hub/Marketplace/Events direction were combined with the marketplace's discovery flows. Her incompatible payment/schema work and placeholder catalogue were not imported.

The original Supabase version remains available for a future Vercel/email-login route. Moving data or accounts between versions is a separate migration, not copying database files. Neither shared passwords nor secret keys belong in GitHub or chat.

## Before a wider public launch

- Give Alea named access to the repository, Site and administrator account role.
- Agree who checks applications, event accuracy and reported content.
- Confirm the operator/privacy wording and retention/deletion process.
- Document database and photo backups, export/restore and monitoring.
- Verify sign-in, profile persistence and a real approved listing on the public link.
- Keep the existing root/www and email DNS intact.

For build commands, schema migrations, upload protections, admin configuration, test evidence, rollback and design provenance, use [SITES_HANDOFF.md](sites/SITES_HANDOFF.md).
