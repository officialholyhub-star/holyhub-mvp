# HolyHub Platform — Stage 1 Foundation

This is the separate HolyHub application intended to sit behind `app.holyhub.co.uk` later. It does not modify the existing `holyhub.co.uk` landing page.

## Included in Stage 1

- Next.js + TypeScript application shell
- Supabase Auth/database foundation
- One account can hold multiple roles (customer now; lister/admin access added separately)
- Sign up, email/password login, logout
- Email confirmation route
- Forgot/reset password flow
- Basic profile and email management
- Protected account route
- PostgreSQL roles/profile schema
- Row Level Security policies
- Baby blue + pink HolyHub styling and supplied logo

## Deliberately NOT included yet

Lister applications/storefronts, products, marketplace, search, basket, Stripe checkout, orders, payouts, commissions, reserves, refunds, admin dashboard, events and Bible functionality. Those belong to later approved stages.

## Free local setup

1. Create a free Supabase project.
2. Copy `.env.example` to `.env.local` and add the Project URL + Publishable key from Supabase's Connect panel.
3. In Supabase SQL Editor, run `supabase/migrations/001_stage1_foundation.sql` once.
4. In Supabase Auth URL settings use `http://localhost:3000` as the local Site URL and add `http://localhost:3000/**` as an allowed redirect while developing.
5. For the Confirm signup email template, use the SSR token-hash route:
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
6. Install packages with `npm install`.
7. Start locally with `npm run dev` and visit `http://localhost:3000`.

When the app is ready for its subdomain, change `NEXT_PUBLIC_SITE_URL` and Supabase's allowed URLs to `https://app.holyhub.co.uk`.

## Stage boundary

Do not begin Stage 2 until Stage 1 has been reviewed and approved.
