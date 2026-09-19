# HolyHub Platform

HolyHub is a Christian platform built around three clear areas: **The Hub, Marketplace and Events**.

> **Current product source of truth:** see [HOLYHUB_MASTER_SPEC.md](./HOLYHUB_MASTER_SPEC.md). Older stage documents are historical and should not override the master spec.

The application is intended to sit at `app.holyhub.co.uk` later. It remains separate from the existing `holyhub.co.uk` landing page.

## Current build

The current working branch includes:

- Next.js + TypeScript
- Supabase Auth/database foundation
- customer/lister role model
- signup, login, logout, confirmation and password reset
- lister applications and lister access
- storefront and product management
- Marketplace search/filter/product pages
- basket and Stripe Checkout
- Stripe webhook payment status tracking
- three-section navigation: The Hub | Marketplace | Events
- Verse of the Day on The Hub and homepage
- responsive HolyHub styling

See the master spec for features that are decided but not yet implemented.

## Local/Codespaces setup

1. Copy `.env.example` to `.env.local` and add the required Supabase/Stripe values.
2. Apply migrations in `supabase/migrations` in numerical order for a fresh database.
3. Install packages with `npm install`.
4. Start locally with `npm run dev`, or in Codespaces with `npm run dev:codespace`.
5. Open port 3000.

For Stripe testing you need:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

Never expose server-only secrets to browser code.

When the app is ready for its subdomain, update `NEXT_PUBLIC_SITE_URL` and the Supabase allowed URLs to `https://app.holyhub.co.uk`.

## Historical files

`STAGE_1_DECISIONS.md` and older stage-labelled notes are retained for history. They are not the current product source of truth.
