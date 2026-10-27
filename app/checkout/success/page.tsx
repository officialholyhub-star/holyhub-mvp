import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
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
        const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
        const admin = createAdminClient();

        if (checkout.status === "pending") {
          const { error } = await admin.rpc("process_checkout_payment", {
            p_stripe_session_id: session.id,
            p_status: "paid",
            p_payment_status: session.payment_status,
            p_amount_total: session.amount_total,
            p_currency: session.currency,
            p_payment_intent_id: paymentIntentId,
            p_delivery_address: {}, // The database uses the immutable HolyHub checkout snapshot.
          });
          if (error) {
            unavailable = true;
            console.error("Checkout success reconciliation failed", { sessionId: session.id, code: error.code });
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
  const title = confirmed ? "Thank you for your order" : unsuccessful ? "We couldn’t confirm this payment." : pending ? "Thank you for your order" : "We couldn’t confirm this payment.";
  const message = confirmed
    ? "Your payment has been confirmed."
    : pending
      ? "We’re confirming your payment. This usually only takes a moment."
      : "We couldn’t confirm this payment. Check My orders or contact HolyHub before trying another payment.";

  return (
    <section className="auth-wrap">
      <div className="card">
        <p className="eyebrow">HolyHub checkout</p>
        <h2>{title}</h2>
        <p>{message}</p>
        {!confirmed && <div className="row-actions">{!unsuccessful && <a className="button button-quiet" href={params.session_id ? `/checkout/success?session_id=${encodeURIComponent(params.session_id)}` : "/checkout/success"}>Refresh</a>}<Link className="text-link" href="/account/orders">My orders</Link><Link className="text-link" href="/contact">Contact HolyHub</Link></div>}
        <div className="button-row"><Link className="button button-primary" href="/marketplace">Continue shopping</Link><Link className="button button-quiet" href="/account">Back to account</Link></div>
      </div>
    </section>
  );
}
