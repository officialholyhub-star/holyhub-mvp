import Stripe from "stripe";

let stripeClient: Stripe | undefined;

export function getStripe() {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured.");
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

export function getSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL is not configured.");
  return siteUrl.replace(/\/$/, "");
}