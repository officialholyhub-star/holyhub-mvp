// Replay a real Stripe TEST event to the local app. This invokes the normal
// signed handler and can create an order/decrement stock for that test checkout.
// It never fabricates a payment, connects to a public app, or edits schema.
import nextEnv from "@next/env";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd(), true);
const key = process.env.STRIPE_SECRET_KEY;
const secret = process.env.STRIPE_WEBHOOK_SECRET;
const eventId = process.argv[2];
if (!key?.startsWith("sk_test_") || !secret?.startsWith("whsec_")) throw new Error("A Stripe TEST key and local signing secret are required.");
if (!/^evt_[A-Za-z0-9]+$/.test(eventId ?? "")) throw new Error("Usage: node scripts/stripe-test-replay.mjs evt_...");
const stripe = new Stripe(key, { maxNetworkRetries: 0, timeout: 15000 });
const event = await stripe.events.retrieve(eventId);
const session = event.data.object;
const allowed = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"];
if (event.livemode || session.livemode || !session.id?.startsWith("cs_test_") || !allowed.includes(event.type)) throw new Error("Only real TEST checkout events can be replayed.");
const current = await stripe.checkout.sessions.retrieve(session.id);
const paidEvent = event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded";
if (current.livemode || (paidEvent && (session.payment_status !== "paid" || current.payment_status !== "paid"))) throw new Error("Stripe has not confirmed this TEST checkout as paid.");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: checkout, error } = await supabase.from("checkout_sessions").select("id,user_id,amount_total").eq("stripe_checkout_session_id", session.id).single();
if (error || !checkout || session.metadata?.holyhub_user_id !== checkout.user_id || (paidEvent && session.amount_total !== checkout.amount_total)) throw new Error("TEST checkout snapshot/metadata/amount could not be verified; replay refused.");
const payload = JSON.stringify(event);
// This is a local replay using the configured local secret. It proves handler
// and database processing, not delivery from a Stripe Dashboard endpoint.
const response = await fetch("http://127.0.0.1:3000/api/stripe/webhook", {
  method: "POST", body: payload, signal: AbortSignal.timeout(30000),
  headers: { "content-type": "application/json", "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret }) },
});
console.log(JSON.stringify({ eventId: event.id, eventType: event.type, sessionId: session.id, localReplay: true, httpStatus: response.status }));
if (!response.ok) throw new Error("Local TEST webhook replay failed. Inspect the dev server's event/session logs.");
const { data: orders, error: orderError } = await supabase.from("orders").select("id,order_status").eq("stripe_checkout_session_id", session.id);
if (orderError) throw new Error("Could not verify order after replay.");
console.log(JSON.stringify({ orders }));
if (paidEvent && (orders.length !== 1 || orders[0].order_status !== "paid")) throw new Error("Expected exactly one paid order after TEST replay.");
