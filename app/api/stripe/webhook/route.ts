import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getStripeProcessingFee } from "@/lib/stripe-processing-fee";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";

async function reconcileChargeFee(charge: Stripe.Charge) {
  const paymentIntentId = typeof charge.payment_intent === "string"
    ? charge.payment_intent
    : charge.payment_intent?.id ?? null;
  const balanceTransaction = charge.balance_transaction;
  if (!paymentIntentId || !balanceTransaction) return;

  const stripe = getStripe();
  const transaction = typeof balanceTransaction === "string"
    ? await stripe.balanceTransactions.retrieve(balanceTransaction)
    : balanceTransaction;
  if (!Number.isSafeInteger(transaction.fee) || transaction.fee < 0) {
    throw new Error("Stripe processing fee is invalid.");
  }

  const admin = createAdminClient();
  const { data: checkout, error: checkoutError } = await admin
    .from("checkout_sessions")
    .select("stripe_checkout_session_id")
    .eq("payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (checkoutError) throw checkoutError;
  if (!checkout?.stripe_checkout_session_id) return;

  const { error } = await admin.rpc("record_order_stripe_fee", {
    p_stripe_session_id: checkout.stripe_checkout_session_id,
    p_stripe_processing_fee: transaction.fee,
  });
  if (error) throw error;
}

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

  if (["refund.created", "refund.updated", "refund.failed", "transfer.created", "transfer.updated", "transfer.reversed"].includes(event.type)) {
    try {
      const { processFinancialWebhook } = await import("@/lib/payment-operations");
      await processFinancialWebhook(event);
      return NextResponse.json({ received: true });
    } catch {
      console.error("Financial webhook reconciliation failed", { eventId: event.id, eventType: event.type });
      return NextResponse.json({ error: "Financial event requires reconciliation." }, { status: 500 });
    }
  }

  if (event.type === "charge.updated" || event.type === "charge.succeeded") {
    try {
      await reconcileChargeFee(event.data.object as Stripe.Charge);
      return NextResponse.json({ received: true });
    } catch {
      console.error("Stripe charge fee reconciliation failed", { eventId: event.id, eventType: event.type, livemode: event.livemode, chargeId: event.data.object.id, reason: "Check Stripe connectivity and database logs." });
      return NextResponse.json({ error: "Could not record payment fee." }, { status: 500 });
    }
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
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
    const admin = createAdminClient();
    const { data: orderId, error } = await admin.rpc("process_checkout_payment", {
      p_stripe_session_id: session.id,
      p_status: status,
      p_payment_status: session.payment_status,
      p_amount_total: session.amount_total,
      p_currency: session.currency,
      p_payment_intent_id: paymentIntentId,
      p_delivery_address: {}, // The database uses the immutable HolyHub checkout snapshot.
    });
    if (error) {
      console.error("Stripe checkout transaction failed", { ...context, status, code: error.code, reason: databaseFailureReason(error.code, error.message) });
      return NextResponse.json({ error: "Could not record payment and order." }, { status: 500 });
    }
    if (status === "paid" && !orderId) {
      console.error("Stripe checkout transaction returned no order", context);
      return NextResponse.json({ error: "Could not record payment and order." }, { status: 500 });
    }

    if (status === "paid") {
      const stripeProcessingFee = await getStripeProcessingFee(paymentIntentId);
      if (stripeProcessingFee !== null) {
        const { error: feeError } = await admin.rpc("record_order_stripe_fee", {
          p_stripe_session_id: session.id,
          p_stripe_processing_fee: stripeProcessingFee,
        });
        if (feeError) {
          console.error("Stripe fee reconciliation failed", { sessionId: session.id, code: feeError.code });
          return NextResponse.json({ error: "Could not record payment fee." }, { status: 500 });
        }
      }
    }
    console.info("Stripe webhook processed", { ...context, status, orderId: orderId ?? null });
  } catch {
    console.error("Stripe webhook database handling failed", { ...context, reason: "Check Supabase server credentials, connectivity and database logs." });
    return NextResponse.json({ error: "Could not record payment and order." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
