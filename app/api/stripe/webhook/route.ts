import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
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

  try {
    const admin = createAdminClient();
    const update = {
      status,
      payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
      updated_at: new Date().toISOString(),
      completed_at: status === "paid" ? new Date().toISOString() : null,
    };
    const { error } = await admin.from("checkout_sessions").update(update).eq("stripe_checkout_session_id", session.id);
    if (error) {
      console.error("Stripe checkout status update failed", error);
      return NextResponse.json({ error: "Could not record payment status." }, { status: 500 });
    }
  } catch (error) {
    console.error("Stripe webhook database handling failed", error);
    return NextResponse.json({ error: "Could not record payment status." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}