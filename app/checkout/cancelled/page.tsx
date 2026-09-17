import Link from "next/link";

export default function CheckoutCancelledPage() {
  return (
    <section className="auth-wrap">
      <div className="card">
        <p className="eyebrow">HolyHub checkout</p>
        <h2>Checkout cancelled</h2>
        <p>Your basket is still available if you would like to try again.</p>
        <div className="button-row"><Link className="button button-primary" href="/basket">Return to basket</Link><Link className="button button-quiet" href="/marketplace">Continue shopping</Link></div>
      </div>
    </section>
  );
}