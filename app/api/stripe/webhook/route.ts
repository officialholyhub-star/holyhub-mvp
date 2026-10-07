import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getStripeProcessingFee } from "@/lib/stripe-processing-fee";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) return NextResponse.json({ error: "Webhook is not configured." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const status = event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded"
    ? "paid"
    : event.type === "checkout.session.expired"
      ? "cancelled"
      : event.type === "checkout.session.async_payment_failed"
        ? "failed"
        : null;
  if (!status) return NextResponse.json({ received: true });
  if (status === "paid" && session.payment_status !== "paid") return NextResponse.json({ received: true });
  if (status === "paid" && (typeof session.amount_total !== "number" || !Number.isSafeInteger(session.amount_total) || session.amount_total < 0 || session.currency !== "gbp")) {
    return NextResponse.json({ error: "Invalid payment amount or currency." }, { status: 400 });
  }

  try {
    const shippingDetails = session.collected_information?.shipping_details;
    const address = shippingDetails?.address;
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
    const admin = createAdminClient();
    const { error } = await admin.rpc("process_checkout_payment", {
      p_stripe_session_id: session.id,
      p_status: status,
      p_payment_status: session.payment_status,
      p_amount_total: session.amount_total,
      p_currency: session.currency,
      p_payment_intent_id: paymentIntentId,
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
      console.error("Stripe checkout transaction failed", { sessionId: session.id, code: error.code });
      return NextResponse.json({ error: "Could not record payment and order." }, { status: 500 });
    }

    if (status === "paid") {
      const stripeProcessingFee = await getStripeProcessingFee(paymentIntentId);
      const { error: feeError } = await admin.rpc("record_order_stripe_fee", {
        p_stripe_session_id: session.id,
        p_stripe_processing_fee: stripeProcessingFee,
      });
      if (feeError) {
        console.error("Stripe fee reconciliation failed", { sessionId: session.id, code: feeError.code });
        return NextResponse.json({ error: "Could not record payment fee." }, { status: 500 });
      }
    }
  } catch (error) {
    console.error("Stripe webhook database handling failed", error);
    return NextResponse.json({ error: "Could not record payment and order." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
