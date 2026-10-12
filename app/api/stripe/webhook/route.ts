import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";

// Deliberately allowlist diagnostics: Stripe errors can contain the raw signed
// payload, and database details can contain customer/address values.
function databaseFailureReason(code: string | undefined, message: string | undefined) {
  const safeMessages = [
    "Checkout snapshot not found.", "Payment does not match the checkout snapshot.",
    "Incomplete or inconsistent checkout snapshots.", "Invalid product or variant snapshot.",
    "Invalid delivery address snapshot.", "Existing order does not match checkout.",
    "Existing order items do not match checkout.", "Existing seller orders do not match checkout.",
    "Service access is required.",
  ];
  if (message && safeMessages.includes(message)) return message;
  if (code === "PGRST202" || code === "42883") return "Payment processor function is unavailable.";
  if (code === "42501") return "Database permission denied.";
  if (code === "23505") return "Order uniqueness constraint failed.";
  return "Database transaction failed; inspect Supabase logs using the event/session IDs.";
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("Stripe webhook configuration missing", { setting: "STRIPE_WEBHOOK_SECRET" });
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 500 });
  }
  if (!signature) {
    console.error("Stripe webhook signature missing");
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    console.error("Stripe webhook signature verification failed", { reason: "Check that STRIPE_WEBHOOK_SECRET matches the delivering endpoint or CLI listener." });
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const context = { eventId: event.id, eventType: event.type, livemode: event.livemode, sessionId: session.id };
  console.info("Stripe webhook received", context);
  const status = event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded"
    ? "paid"
    : event.type === "checkout.session.expired"
      ? "cancelled"
      : event.type === "checkout.session.async_payment_failed"
        ? "failed"
        : null;
  if (!status) return NextResponse.json({ received: true });
  // Delayed methods complete Checkout before payment succeeds. Await the later
  // async_payment_succeeded event; neither event can fulfil an unpaid session.
  if (status === "paid" && session.payment_status !== "paid") {
    console.info("Stripe webhook awaiting payment", { ...context, paymentStatus: session.payment_status });
    return NextResponse.json({ received: true });
  }
  if (status === "paid" && (typeof session.amount_total !== "number" || !Number.isSafeInteger(session.amount_total) || session.amount_total < 0 || session.currency !== "gbp")) {
    console.error("Stripe webhook payment validation failed", context);
    return NextResponse.json({ error: "Invalid payment amount or currency." }, { status: 400 });
  }

  try {
    const shippingDetails = session.collected_information?.shipping_details;
    const address = shippingDetails?.address;
    // Status, inventory, parent and children commit together. The RPC also
    // serializes terminal events so a late failure cannot overwrite paid state.
    const { data: orderId, error } = await createAdminClient().rpc("process_checkout_payment", {
      p_stripe_session_id: session.id,
      p_status: status,
      p_payment_status: session.payment_status,
      p_amount_total: session.amount_total,
      p_currency: session.currency,
      p_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
      p_delivery_address: {
        delivery_recipient_name: shippingDetails?.name ?? null,
        delivery_address_line1: address?.line1 ?? null,
        delivery_address_line2: address?.line2 ?? null,
        delivery_city: address?.city ?? null,
        delivery_postcode: address?.postal_code ?? null,
        delivery_country: address?.country ?? null,
      },
    });
    if (error) {
      console.error("Stripe checkout transaction failed", { ...context, status, code: error.code, reason: databaseFailureReason(error.code, error.message) });
      return NextResponse.json({ error: "Could not record payment and order." }, { status: 500 });
    }
    if (status === "paid" && !orderId) {
      console.error("Stripe checkout transaction returned no order", context);
      return NextResponse.json({ error: "Could not record payment and order." }, { status: 500 });
    }
    console.info("Stripe webhook processed", { ...context, status, orderId: orderId ?? null });
  } catch {
    console.error("Stripe webhook database handling failed", { ...context, reason: "Check Supabase server credentials, connectivity and database logs." });
    return NextResponse.json({ error: "Could not record payment and order." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
