# HolyHub Master Product Spec

**Status:** Source of truth for the HolyHub MVP and current product decisions.  
**Last updated:** 19 September 2026.

> If an older stage document, README section, implementation note or previous plan conflicts with this file, this file wins unless a newer explicit decision is recorded.

## 1. Product structure

HolyHub is one platform with three clear primary sections:

1. **The Hub**
2. **Marketplace**
3. **Events**

Primary navigation should read: **The Hub | Marketplace | Events**.

Account, Basket and Lister Dashboard are secondary account/action areas and must not look like a fourth primary section.

### The Hub

The Hub is the faith/community side of HolyHub. Planned/current areas include:

- Bible reader
- Verse of the Day
- Christian community
- opportunities
- conversations/discussions
- faith-focused content

**Verse of the Day:** show a real Bible verse that automatically changes each calendar day. It should appear prominently on The Hub and in a smaller form on the homepage. Scripture must never be AI-invented or paraphrased as though it is a Bible quotation. Current implementation uses the public-domain World English Bible British Edition.

The full Bible reader belongs at **/hub/bible**, not as a fourth main navigation section.

### Marketplace

Marketplace is the main MVP/live focus.

Customers can:

- discover Christian brands/listers
- browse published products
- search/filter products
- visit product pages and lister storefronts
- add products to a basket
- check out through Stripe

Listers can:

- have one HolyHub account with lister access
- create/edit a storefront
- create/edit product listings
- publish/unpublish listings
- manage inventory/listings through the lister area

### Events

Events is a clear standalone section but is not the main MVP build priority yet.

Planned discovery includes:

- conferences
- worship nights
- festivals
- Christian activities
- public-facing opportunities

Ticket purchasing is later.

## 2. Branding and UX

- Slogan: **Connect. Discover. Grow.**
- clean, minimal and cohesive
- baby blue is the primary colour
- pink is the main accent
- use the supplied HolyHub logo
- mobile-first/responsive
- avoid filler content
- Marketplace should feel live; unreleased Hub/Event features should be honestly labelled as coming soon
- no fake marketplace products should be shown as real listings

## 3. Accounts and roles

- one HolyHub login can hold multiple roles
- every new account begins as a customer
- approved users can gain lister access without creating a second login
- lister applications require approval
- admin access is separate

## 4. Lister pricing

Current pricing rule:

- first **10 active product listings at a time** are free for each lister
- active listings above 10 cost **£0.20 per listing**
- this is not a lifetime allowance
- sales commission is **5%**
- the 5% commission applies to the **product subtotal only**
- delivery charges are excluded from HolyHub's 5% commission
- featured listings are a later optional paid promotion
- HolyHub Plus is later

## 5. Shipping — MVP

- MVP shipping is **UK only**
- each seller/lister chooses either:
  - free delivery, or
  - a flat delivery charge
- delivery is charged **once per seller in an order**, not once per product
- sellers handle their own fulfilment/shipping

## 6. Checkout and payments

Target flow:

Customer pays → Stripe/HolyHub processes payment → HolyHub commission is recorded → seller amount becomes payable subject to payout/reserve rules.

Checkout must always reload trusted product/pricing data from the database rather than trusting basket prices from the browser.

## 7. Payout and reserve rules

Current decisions:

- untracked order: main payout becomes eligible **21 days after dispatch**
- reserve for an untracked order releases **30 days after dispatch**
- new listers: target reserve range **10–20% for 14–30 days**
- established listers: target reserve **0–10%** depending on history
- higher-risk listers: **30%+ temporarily** where justified

Exact automated risk-tier mechanics can be implemented in a later payment/admin stage.

## 8. Refunds and disputes

Planned refund system:

- customer refund flow/quiz
- seller response/refund flow
- admin appeal/review option
- reserve exists in part to cover refunds/chargebacks

## 9. Current implementation status

Implemented or substantially present:

- Next.js/TypeScript app shell
- Supabase auth
- account creation/login/password reset/email confirmation
- roles and lister approval foundations
- storefront management
- product listing management
- marketplace browsing/search/filtering
- basket
- Stripe Checkout session creation
- Stripe webhook payment status updates
- Hub/Marketplace/Events top-level structure
- responsive HolyHub design
- Verse of the Day rotation/display

Not yet fully implemented:

- first-10-active-listings enforcement
- £0.20 additional active listing charging
- seller shipping settings
- per-seller delivery calculation in basket/checkout
- formal 5% commission accounting records
- seller-order/payout ledger
- payout eligibility automation
- reserve tracking/release automation
- refund workflow and appeals
- full admin dashboard
- event listings/ticketing
- full Bible reader in GitHub (older reader currently exists only in the Codespaces stash and must be restored safely into /hub/bible)

## 10. Technical direction

- Next.js + TypeScript
- Supabase/PostgreSQL
- Stripe
- GitHub/Codespaces
- future app domain: **app.holyhub.co.uk**
- existing **holyhub.co.uk** landing page remains separate for now

## 11. Safety rules for future development

- do not delete/break working auth, marketplace, lister or checkout functionality when adding later stages
- database changes should be added through reviewed migrations
- do not expose Supabase service-role or Stripe secret keys to browser code
- do not mark planned functionality as live when it is only a placeholder
- update this master spec whenever a product rule is changed

## 12. Launch legal and trust pages

These pages are now present in the app. Their wording must continue to match the implemented product behaviour, and a one-off legal review is still required before live customer payments:


- **Customer Terms & Conditions** — account use, marketplace role, ordering, payment, delivery, cancellations/returns, refunds, prohibited use, liability and complaints
- **Lister Terms** — eligibility, listing rules, fees, 5% commission, listing charges, fulfilment, shipping, reserves, payouts, refunds/chargebacks, prohibited products, suspension/termination and seller responsibilities
- **Privacy Notice**
- **Cookie Notice / consent where required**
- **Shipping & Delivery Policy**
- **Returns & Refunds Policy**
- **Contact page/details**

Full launch blockers and follow-up work are tracked in **LAUNCH_CHECKLIST.md**. The private business address must be supplied through the `HOLYHUB_BUSINESS_ADDRESS` environment variable rather than committed to this public repository.

