import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

type CheckoutSnapshot = {
  status: string;
  amount_total: number;
  currency: string;
};

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const loadCheckout = async (): Promise<CheckoutSnapshot | null> => {
    if (!params.session_id) return null;
    const { data } = await supabase
      .from("checkout_sessions")
      .select("status, amount_total, currency")
      .eq("stripe_checkout_session_id", params.session_id)
      .eq("user_id", user.id)
      .maybeSingle();
    return data;
  };

  let checkout = await loadCheckout();

  // Webhooks remain the primary source of payment completion. This server-side
  // reconciliation safely recovers a paid Checkout Session when the webhook is
  // delayed or temporarily unreachable (for example, in a development tunnel).
  if (params.session_id && checkout?.status === "pending") {
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
        const { error } = await createAdminClient().rpc("process_checkout_payment", {
          p_stripe_session_id: session.id,
          p_status: "paid",
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
          console.error("Checkout success reconciliation failed", { sessionId: session.id, code: error.code });
        } else {
          checkout = await loadCheckout();
        }
      }
    } catch (error) {
      console.error("Checkout success Stripe verification failed", error);
    }
  }

  return (
    <section className="auth-wrap">
      <div className="card">
        <p className="eyebrow">HolyHub checkout</p>
        <h2>Thank you for your payment</h2>
        <p>{checkout?.status === "paid" ? "Your payment has been confirmed." : "Your payment return was received. Payment confirmation is completed securely by Stripe webhook."}</p>
        <div className="button-row"><Link className="button button-primary" href="/marketplace">Continue shopping</Link><Link className="button button-quiet" href="/account">Back to account</Link></div>
      </div>
    </section>
  );
}
