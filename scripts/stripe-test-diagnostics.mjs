// Read-only diagnostics. Never print credentials, addresses, emails or payloads.
import nextEnv from "@next/env";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd(), true);
const key = process.env.STRIPE_SECRET_KEY;
if (!key?.startsWith("sk_test_")) throw new Error("Diagnostics require a Stripe TEST secret key.");
const stripe = new Stripe(key, { maxNetworkRetries: 0, timeout: 15000 });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
console.log(JSON.stringify({ configuration: {
  stripeTestKey: true,
  webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  webhookSecretLooksValid: process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_") ?? false,
  webhookSecretIsPlaceholder: /your_|placeholder|example/.test(process.env.STRIPE_WEBHOOK_SECRET ?? ""),
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  codespace: process.env.CODESPACE_NAME ?? null,
} }));

const sessions = await stripe.checkout.sessions.list({ limit: 10 });
const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
console.log(JSON.stringify({ webhookEndpoints: endpoints.data.filter(e => !e.livemode).map(e => ({ id: e.id, url: e.url, status: e.status, enabledEvents: e.enabled_events })) }));
for (const session of sessions.data) {
  if (session.livemode) throw new Error("Unexpected live session; stopped.");
  const { data: checkout, error } = await supabase.from("checkout_sessions")
    .select("id,user_id,status,amount_total,currency").eq("stripe_checkout_session_id", session.id).maybeSingle();
  const { data: orders, error: orderError } = checkout ? await supabase.from("orders")
    .select("id,user_id,order_status").eq("checkout_session_id", checkout.id) : { data: [], error: null };
  const orderIds = (orders ?? []).map(order => order.id);
  const queries = checkout ? await Promise.all([
    supabase.from("checkout_session_items").select("id", { count: "exact", head: true }).eq("checkout_session_id", checkout.id),
    supabase.from("checkout_session_sellers").select("lister_user_id", { count: "exact", head: true }).eq("checkout_session_id", checkout.id),
    ...(orderIds.length ? [
      supabase.from("seller_orders").select("id", { count: "exact", head: true }).in("order_id", orderIds),
      supabase.from("order_items").select("id", { count: "exact", head: true }).in("order_id", orderIds),
    ] : []),
  ]) : [];
  console.log(JSON.stringify({ session: {
    id: session.id, created: new Date(session.created * 1000).toISOString(), status: session.status,
    paymentStatus: session.payment_status, amountTotal: session.amount_total, currency: session.currency,
    hasUserMetadata: Boolean(session.metadata?.holyhub_user_id),
    metadataMatchesCheckoutUser: checkout ? session.metadata?.holyhub_user_id === checkout.user_id : null,
    checkout: checkout ? { id: checkout.id, status: checkout.status, amountTotal: checkout.amount_total, currency: checkout.currency } : null,
    orders: (orders ?? []).map(order => ({ id: order.id, status: order.order_status, userMatchesCheckout: order.user_id === checkout?.user_id })),
    snapshotItems: queries[0]?.count ?? null, snapshotSellers: queries[1]?.count ?? null,
    sellerOrders: queries[2]?.count ?? 0, orderItems: queries[3]?.count ?? 0,
    errors: [error, orderError, ...queries.map(q => q.error)].filter(Boolean).map(e => ({ code: e.code, message: e.message })),
  } }));
}
const events = await stripe.events.list({ type: "checkout.session.completed", limit: 10 });
console.log(JSON.stringify({ completedEvents: events.data.filter(e => !e.livemode).map(e => ({
  id: e.id, created: new Date(e.created * 1000).toISOString(), sessionId: e.data.object.id,
  pendingWebhooks: e.pending_webhooks,
})) }));
