# HolyHub Launch Checklist

**Purpose:** Running list of anything that still needs to be completed, verified or revisited.  
**Last updated:** 19 September 2026.

This file should be updated whenever a launch task is completed or a new dependency is discovered.

## BLOCKERS — complete before accepting real customer payments

### Legal, privacy and trust
- [x] Customer Terms & Conditions page
- [x] Lister Terms page
- [x] Privacy Notice
- [x] Cookie & Device Storage Notice
- [x] Shipping & Delivery Policy
- [x] Returns & Refunds Policy
- [x] Contact page
- [x] Footer links to legal/support pages
- [x] Terms checkbox at customer account creation
- [x] Terms checkbox before checkout
- [x] Lister Terms checkbox on lister application
- [ ] Add the real HolyHub business contact address to the private `HOLYHUB_BUSINESS_ADDRESS` environment variable for preview/deployment. Do not commit the home address to the public repository.
- [ ] One-off UK solicitor review of Customer Terms, Lister Terms, refund wording, marketplace/seller relationship and payout/reserve wording before live payments.
- [ ] Confirm whether Alea/HolyHub must pay the ICO data protection fee and complete registration if required.
- [ ] Create a documented personal-data retention schedule.
- [ ] Review Supabase, Stripe and any future service providers for privacy/data-processing terms and international-transfer safeguards.
- [ ] If non-essential analytics, advertising or tracking is ever added, implement cookie consent before enabling it and update the Cookie Notice.
- [ ] Confirm whether any digital-platform reporting obligations apply to HolyHub if the legal/business structure changes. Current GOV.UK guidance includes an exclusion where a platform is run only as a sole trader, but this must be rechecked if HolyHub becomes a limited company or the model changes.
- [ ] Store/version acceptance timestamps for Customer Terms and Lister Terms in the database rather than relying only on a checkbox at submission time.
- [ ] Make the applicable terms available in a durable order confirmation/email.

### Seller/lister information
- [ ] Add a lister return address field and make sure it is supplied securely to customers only where needed for returns.
- [ ] Add seller dispatch/fulfilment information.
- [ ] Add seller shipping setting: free delivery or flat delivery charge.
- [ ] Verify seller identity/business information before live selling at the level required by payments, tax and marketplace rules.
- [ ] Add a clear prohibited/restricted-products policy and admin moderation process.
- [ ] Add lister inventory/stock quantity and prevent checkout when stock is unavailable.

### Listing fees and commission
- [ ] Enforce first 10 active product listings per lister as free.
- [ ] Implement £0.20 charge for each active listing above 10.
- [ ] Keep the allowance based on active listings at a time, not lifetime listings.
- [ ] Implement and record HolyHub's 5% commission on product subtotal only.
- [ ] Exclude delivery charges from the 5% commission.
- [ ] Make fee waivers/pilot pricing clear to listers before paid fees are activated.

### Shipping and basket
- [x] Limit live checkout to UK delivery addresses.
- [x] Add delivery charge to basket and Stripe checkout.
- [x] Charge delivery once per lister/seller in an order, not once per item.
- [x] Show delivery charges and delivery information before the customer commits to payment.
- [x] Support multi-lister baskets as separate seller fulfilment groups.
- [x] Ensure customers can review/correct basket and delivery information before payment.

### Orders, payments and payouts
- [ ] Confirm final Stripe marketplace architecture for paying independent listers (for example Stripe Connect) with Stripe/accountant/legal review.
- [x] Create proper order records after successful payment, not only checkout-session records.
- [x] Create seller-order records for multi-lister orders.
- [ ] Give customers an order history/status page.
- [ ] Give listers an order/fulfilment dashboard.
- [ ] Add dispatch status and dispatch date.
- [ ] Add tracking number/carrier where a seller uses tracked shipping.
- [ ] Implement main payout eligibility for untracked orders at 21 days after dispatch.
- [ ] Implement reserve tracking and release at 30 days after dispatch for untracked orders.
- [ ] Implement risk/reserve tiers: new listers 10–20% target; established 0–10%; higher-risk 30%+ temporarily where justified.
- [ ] Record payout, reserve, commission, refund and chargeback movements in a ledger.
- [ ] Handle Stripe refunds, disputes, chargebacks and webhook retries/idempotency safely.
- [ ] Confirm live Stripe keys/webhook endpoint and test mode/live mode separation.

### Refunds and customer support
- [ ] Build customer refund request/quiz.
- [ ] Build lister refund response flow.
- [ ] Build admin review/appeal flow.
- [ ] Ensure returns always direct physical goods to the relevant lister, not HolyHub's business contact address.
- [ ] Add clear support workflow and internal record of customer/lister disputes.
- [ ] Add cancellation/return instructions to order confirmation.

### Emails and confirmations
- [ ] Send customer order confirmation with seller, products, price, delivery charge, delivery information, cancellation information and applicable terms.
- [ ] Send lister new-order notification.
- [ ] Send dispatch confirmation to customer.
- [ ] Send refund/cancellation confirmations.
- [ ] Verify all auth emails and links on the production domain.

### Technical launch checks
- [ ] Run and pass `npm run lint`.
- [ ] Run and pass `npm run build`.
- [ ] Update CI so it runs on the active/pre-launch branch or run it manually against the exact release commit.
- [ ] Complete full end-to-end Stripe test: signup → product → basket → checkout → successful payment → webhook → order record.
- [ ] Test failed, cancelled and duplicate/retried payment events.
- [ ] Test customer, lister and admin permissions/RLS.
- [ ] Apply and verify every required Supabase migration on the production project.
- [ ] Deploy to `app.holyhub.co.uk`.
- [ ] Configure Supabase production redirect URLs for the final domain.
- [ ] Set production environment variables/secrets securely.
- [ ] Test mobile layout on real phone sizes and desktop browsers.
- [ ] Add error monitoring/logging appropriate for launch.
- [ ] Back up/export critical marketplace and order data appropriately.

## SHOULD DO BEFORE WIDER PUBLIC LAUNCH

- [ ] Change Marketplace status/wording from beta/testing to Live only once checkout, shipping, orders and payouts are genuinely live.
- [ ] Add clear About/How HolyHub works explanation for customers.
- [ ] Add clear How selling works/fees page for potential listers.
- [ ] Add FAQ based on real customer/lister questions.
- [ ] Add admin dashboard for approvals, disputes, risk tiers and moderation.
- [ ] Add lister storefront return/support details without exposing private information unnecessarily.
- [ ] Decide support response expectations and document internal process.
- [ ] Test accessibility: keyboard navigation, focus states, labels, contrast and screen-reader basics.
- [ ] Check SEO metadata, social-sharing image, favicon and page titles.
- [ ] Check all empty/error/loading states.

## HUB / CONTENT — can continue alongside marketplace

- [ ] Safely restore the existing Bible reader from the Codespaces stash into `/hub/bible` without restoring unrelated old files.
- [ ] Expand Verse of the Day beyond the initial small rotation so regular users do not see frequent repeats.
- [ ] Confirm Bible translation/source attribution and keep Scripture quotations exact.
- [ ] Build Community later.
- [ ] Build Opportunities later.
- [ ] Build Conversations later.

## EVENTS — later

- [ ] Build event listing submission/admin approval.
- [ ] Build event search/filter/discovery.
- [ ] Decide event organiser terms.
- [ ] Add ticketing only after marketplace payments/payouts are stable.
- [ ] Confirm event-ticket commission before ticketing goes live.

## LATER MONETISATION / GROWTH

- [ ] Featured listings.
- [ ] HolyHub Plus.
- [ ] Optional paid promotion/advertising.
- [ ] If analytics/ads are introduced, update privacy/cookies and implement consent first.

## Business/admin reminders

- [ ] Keep HolyHub finances separate from personal spending.
- [ ] Keep records required for sole-trader tax/accounting.
- [ ] Revisit limited-company timing after validation.
- [ ] Revisit the public business address if HolyHub later moves to a virtual/business address.
- [ ] Have accountant review marketplace payment, commission, seller payouts, reserves and tax treatment before live scale.
