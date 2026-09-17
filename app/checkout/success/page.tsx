import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const { data: checkout } = params.session_id
    ? await supabase.from("checkout_sessions").select("status, amount_total").eq("stripe_checkout_session_id", params.session_id).eq("user_id", user.id).maybeSingle()
    : { data: null };

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