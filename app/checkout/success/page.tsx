import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { prepareOrderConfirmationTrigger } from "@/lib/order-confirmation-trigger";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { getStripeProcessingFee } from "@/lib/stripe-processing-fee";

export const dynamic = "force-dynamic";

type CheckoutSnapshot = {
  status: string;
  amount_total: number;
  currency: string;
};

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const loadCheckout = async (): Promise<{ data: CheckoutSnapshot | null; error: unknown }> => {
    if (!params.session_id) return { data: null, error: null };
    const { data, error } = await supabase
      .from("checkout_sessions")
      .select("status, amount_total, currency")
      .eq("stripe_checkout_session_id", params.session_id)
      .eq("user_id", user.id)
      .maybeSingle();
    return { data, error };
  };

  const initial = await loadCheckout();
  let unavailable = Boolean(initial.error);
  let checkout = initial.data;

  // Webhooks remain primary. This also recovers a paid order or fee breakdown
  // when a development webhook is delayed or temporarily unreachable.
  if (params.session_id && checkout && (checkout.status === "pending" || checkout.status === "paid")) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(params.session_id);
      const stripeCurrency = session.currency?.toUpperCase();

      if (
        session.payment_status === "paid"
        && typeof session.amount_total === "number"
        && session.amount_total === checkout.amount_total
        && stripeCurrency === checkout.currency.toUpperCase()
      ) {
        const shippingDetails = session.collected_information?.shipping_details;
        const address = shippingDetails?.address;
        const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
        const admin = createAdminClient();

        if (checkout.status === "pending") {
          const { data: orderId, error } = await admin.rpc("process_checkout_payment", {
            p_stripe_session_id: session.id,
            p_status: "paid",
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
            unavailable = true;
            console.error("Checkout success reconciliation failed", { sessionId: session.id, code: error.code });
          } else if (orderId) {
            const confirmation = prepareOrderConfirmationTrigger(String(orderId));
            console.info("Customer order confirmation recovery trigger reached", {
              orderId: confirmation.orderId,
              confirmationStatus: confirmation.status,
              blockers: confirmation.blockers,
              idempotencyKey: confirmation.idempotencyKey,
            });
          }
        }

        const stripeProcessingFee = await getStripeProcessingFee(paymentIntentId);
        if (stripeProcessingFee !== null) {
          const { error: feeError } = await admin.rpc("record_order_stripe_fee", {
            p_stripe_session_id: session.id,
            p_stripe_processing_fee: stripeProcessingFee,
          });
          if (feeError) console.error("Checkout success fee reconciliation failed", { sessionId: session.id, code: feeError.code });
        }

        const refreshed = await loadCheckout();
        checkout = refreshed.data;
        unavailable = unavailable || Boolean(refreshed.error);
      }
    } catch (error) {
      unavailable = true;
      console.error("Checkout success Stripe verification failed", error);
    }
  }

  const confirmed = !unavailable && checkout?.status === "paid";
  const unsuccessful = !unavailable && (checkout?.status === "failed" || checkout?.status === "cancelled");
  const pending = !unavailable && checkout?.status === "pending";
  return (
    <section className="auth-wrap">
      <div className="card">
        <p className="eyebrow">HolyHub checkout</p>
        <h2>{confirmed ? "Thank you for your payment" : unsuccessful ? "Checkout was not completed" : "We couldn’t confirm your payment yet."}</h2>
        <p>{confirmed ? "Your payment has been confirmed." : unsuccessful ? "This checkout is marked as failed or cancelled. Check My Purchases before starting another checkout." : pending ? "Your payment is still being verified. Please wait, then refresh or check My Purchases. Do not pay again while its status is uncertain." : "Payment details are unavailable. Check My Purchases or contact HolyHub before trying another payment."}</p>
        <div className="row-actions"><Link className="button button-primary" href="/account/orders">Check My Purchases</Link>{!confirmed && !unsuccessful && <a className="button button-quiet" href={params.session_id ? `/checkout/success?session_id=${encodeURIComponent(params.session_id)}` : "/checkout/success"}>Refresh</a>}{unsuccessful && <Link className="button button-quiet" href="/basket">Return to basket</Link>}{!confirmed && <Link className="text-link" href="/contact">Contact HolyHub</Link>}</div>
        <div className="button-row"><Link className="button button-primary" href="/marketplace">Continue shopping</Link><Link className="button button-quiet" href="/account">Back to account</Link></div>
      </div>
    </section>
  );
}
