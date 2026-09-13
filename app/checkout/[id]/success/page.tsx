import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { isUuid } from "@/lib/businesses";
import { money } from "@/lib/marketplace";

export default async function CheckoutSuccess({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { supabase, user } = await requireUser(`/checkout/${id}/success`);
  const { data: order, error } = await supabase.from("orders").select("id,status,subtotal_pence,checkout_state").eq("id", id).eq("customer_id", user.id).maybeSingle();
  if (error) throw new Error("Order unavailable");
  if (!order) notFound();
  const paid = order.status === "paid";
  return <section className="content-narrow"><div className="section-heading"><p className="eyebrow">{paid ? "Payment confirmed" : "Payment received"}</p><h1 className="page-title">{paid ? "Your order is on its way." : "We are confirming your payment."}</h1><p>{paid ? "Thank you for supporting Christian businesses. Your order has been recorded securely." : "Stripe has returned you to HolyHub, but the verified webhook has not completed yet. Your order will update automatically once confirmation arrives."}</p></div><div className="card"><div className="meta-row"><span>Order</span><strong>{id.slice(0, 8).toUpperCase()}</strong></div><div className="meta-row"><span>Item subtotal</span><strong>{money(order.subtotal_pence)}</strong></div>{!paid&&<p className="notice notice-info">Do not pay again while this confirmation is pending.</p>}<Link className="button button-primary full-width" href={paid?`/orders/${id}`:"/orders"}>{paid ? "View your order" : "View order status"}</Link><p className="muted-small">Shipping and tax are not included in this MVP checkout.</p></div></section>;
}
