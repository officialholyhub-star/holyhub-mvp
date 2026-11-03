# HolyHub Sites marketplace — handoff

## Release scope

This is the **non-payment discovery MVP**, rebuilt for OpenAI Sites with the owner's explicit approval on 20 September 2026. It uses Sites D1 storage, private R2 photo storage and dispatch-owned ChatGPT sign-in. It does not depend on Supabase. Customers need a ChatGPT account to create/manage a HolyHub account; public browsing needs no sign-in.

The original Next.js/Supabase marketplace remains available separately in the HolyHub GitHub repository. Do not apply its PostgreSQL migrations to this SQLite database or merge Alea's Stripe branch wholesale. No existing Supabase users, listings or passwords were imported. A migration between identity systems needs explicit account linking; do not match private accounts solely by email.

## What works

- Public product search, categories, stock filter, price sorting, pagination, business profiles and event discovery.
- Authenticated profiles, one business application per member, owner editing and resubmission.
- Human admin approval/rejection/suspension; owner-facing review notes and in-account updates.
- Product drafts, GBP prices stored as integer pence, quantity, delivery information, up to five photos, publication and archive.
- Publication requires an approved business; drafts and hidden/suspended content are not publicly readable, including photos.
- Admin product moderation, account suspension, event draft/edit/publish/archive and activity records.
- Persistent data survives sign-out, browser refresh and redeployment. No fictional listings are in migrations.

## Deliberately not included

No checkout, Stripe, commissions, listing charges, payouts, financial reserve, loyalty points, monetary refunds or tickets. Purchasing happens directly with the linked business. The Hub connects existing discovery routes; it is **not** a community chat, Bible reader or social feed. Email/password registration and recovery are handled by ChatGPT rather than HolyHub. Review notifications are in-account, not email alerts.

Do not label all ten original PRD stages complete. This hosted release covers the non-payment account, lister, product-discovery and simple event workflows. Financial/community/Bible stages from the broader PRD remain separate work.

## Administration

`HOLYHUB_ADMIN_EMAILS` is a **server-only Sites runtime secret**, an exact comma-separated allowlist checked against the authenticated ChatGPT email. The initial permitted account is `matthewjeanty6@gmail.com`. Sign in with that ChatGPT account, open `/account`, then **Open administration**. There is no first-user-becomes-admin behavior, client-provided role, or public role grant.

To give Alea administration, first confirm her actual ChatGPT email, then the Site owner updates this runtime allowlist and redeploys. Do not use a shared password. GitHub write access does not grant Site administration.

## Source, hosting and rollback

- Existing Site reused: `appgprj_6a8d1bb958ec8191bcc942bec6c48a65`, previously Deepgrids / `deepgrids-ace`; no custom domains were attached when inspected.
- The root HolyHub landing Site, `holyhub.co.uk` and `www.holyhub.co.uk`, are unchanged.
- The Sites source repository retains all prior versions. Local branch `archive/deepgrids-before-holyhub` preserves the prior source; previous published version was 11. Do not remove this rollback history.
- `.openai/hosting.json` declares only the project identity and DB/BUCKET bindings. Runtime secrets never belong in that file.
- Deployment must use the real Worker build (`dist/server/index.js`) and generated schema migrations. Never upload the temporary local `.wrangler` data, `.dev.vars`, test fixtures or a static page copy as the application.
- Migrations become immutable once deployed. Append new Drizzle migrations; do not alter an applied SQL file.

## Local development

Use Node 24 and the existing pnpm lockfile. Install with `npx pnpm@10.15.1 install --frozen-lockfile`. Run `npm run build` to emit the Worker and local binding config. Generate schema deltas with `npx pnpm@10.15.1 exec drizzle-kit generate`.

For a fresh local database, apply `drizzle/0000_milky_madame_hydra.sql` once using Wrangler D1 `--local`, configuration `dist/server/wrangler.json`, and persistence root `.wrangler/state`. Never use `--remote` for local tests. Create an ignored `.dev.vars` containing `HOLYHUB_ADMIN_EMAILS=seedy@sites.test` for local admin testing only.

Run `npm run dev -- --hostname 127.0.0.1 --port 5173`. The vendored Sites development helper simulates the fixed local account `seedy@sites.test`, strips supplied identity headers and restricts the mock to loopback. This mock is not included in the production Worker. Real hosted identity belongs to Sites dispatch.

Run `node tests/smoke.mjs` against that local preview: 30 integration assertions cover the main workflows. It creates **local-only** records and is intentionally hardcoded to loopback. `tests/ownership-fixture.sql` is solely for isolated ownership checks, not a migration. Typecheck with `node node_modules/typescript/bin/tsc --noEmit` and lint with `node node_modules/eslint/bin/eslint.js app components lib db`.

## Security and operational boundaries

Every write requires authenticated identity, an active profile, same-origin submission and bounded form input. All queries are parameterised. Owner IDs, statuses and admin decisions are enforced server-side, not accepted as trusted hidden fields. Version checks prevent stale changes. Moderation visibility is also checked on photo reads. Private responses use no-store where needed.

Images are prepared in the browser, then independently validated on the server: PNG signature/chunk CRCs, bounded dimensions and decompressed size, scanline structure, and no animation. Optional metadata is stripped. Object keys are server-generated; storage is not a public bucket. Image reads recheck visibility and do not use persistent public caching. No raw SVG or arbitrary file upload is supported.

Before a wider launch, the operator should approve the privacy/operator wording, document a retention/deletion process, confirm who reviews submissions, and establish database **and photo** backup/export/restore procedures and monitoring. A deployment does not by itself prove legal compliance or disaster recovery readiness. Check real ChatGPT sign-in on the public URL and give Alea verified admin access before she takes over moderation.

## Design provenance

The original supplied HolyHub logo is unchanged. Deepgrids Sans is hosted locally with its OFL notice. The official slogan remains **Connect. Discover. Grow.**

Alea's `alea/stage4-payments` at `c6cc706cf06cb7aa25a8d8e61b433aa876301b4f` contributed the SVG icon set and inspired the warmer Marketplace/Events/Hub direction. Its payment code, incompatible schema, fake catalogue, and placeholder Bible/community destinations were not merged.

`public/holyhub-community-editorial.webp` is an original AI-generated editorial image, not a product listing or a testimonial. One image was generated with the built-in image tool, then resized/compressed for the page. Prompt: "Premium photoreal portrait editorial close crop of the hands of two adult women, one brown-skinned and one light-skinned, passing an unbranded cream ceramic mug across a sunlit artisan table. Neutral linen, an unbranded notebook and dried flowers; warm cream with powder-blue and blush accents; realistic hands, faces outside the frame; no logos, readable text, church architecture, watermarks or endorsement implication."
