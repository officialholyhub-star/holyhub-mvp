import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { calculateLaunchMetrics } from "@/lib/launch-metrics";
import { readAllRows } from "@/lib/read-all-rows";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const gbp = (amount: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount / 100);
const percent = (value: number | null) => value == null ? "No data" : `${(value * 100).toFixed(1)}%`;

export default async function AdminAnalyticsPage() {
  await requireRole("admin");
  const admin = createAdminClient();
  const [checkouts, orders, fulfilment] = await Promise.all([
    readAllRows(offset => admin.from("checkout_sessions").select("status").order("id").range(offset, offset + 999)),
    readAllRows(offset => admin.from("orders").select("order_status, total_amount, product_subtotal, delivery_total, holyhub_commission, stripe_processing_fee, paid_at").order("id").range(offset, offset + 999)),
    readAllRows(offset => admin.from("seller_orders").select("fulfilment_status").order("id").range(offset, offset + 999)),
  ]);

  const unavailable = Boolean(checkouts.error || orders.error || fulfilment.error);
  const metrics = unavailable ? null : calculateLaunchMetrics(checkouts.data ?? [], orders.data ?? [], fulfilment.data ?? []);

  return (
    <section className="admin-workspace">
      <p className="eyebrow">HolyHub admin</p>
      <h1>Launch metrics</h1>
      <p className="lead">A small, database-backed view of the checkout and order events HolyHub already records.</p>
      <nav className="admin-tabs" aria-label="Admin workspace">
        <Link href="/admin">Overview</Link>
        <Link href="/admin/orders">Orders</Link>
        <Link href="/admin/analytics" aria-current="page">Launch metrics</Link>
      </nav>

      {unavailable || !metrics ? <p className="notice notice-error" role="alert">Launch metrics could not be loaded. Refresh to try again.</p> : <>
        {!metrics.orderIntegrityMatches && <p className="notice notice-error" role="alert">Paid checkout sessions and paid order records do not match. Investigate before relying on conversion or order totals.</p>}
        <div className="admin-overview-grid">
          <article className="admin-overview-card"><span className="admin-card-kicker">Checkout funnel</span><strong>{metrics.checkoutStarts}</strong><h2>Checkout starts</h2><p>{metrics.paidCheckouts} paid · {metrics.pendingCheckouts} pending · {metrics.failedCheckouts} failed · {metrics.cancelledCheckouts} cancelled</p></article>
          <article className="admin-overview-card"><span className="admin-card-kicker">Checkout funnel</span><strong>{percent(metrics.checkoutConversionRate)}</strong><h2>Checkout → paid</h2><p>Paid checkout sessions divided by all recorded checkout starts.</p></article>
          <article className="admin-overview-card"><span className="admin-card-kicker">Orders</span><strong>{metrics.paidOrderCount}</strong><h2>Paid order records</h2><p>{metrics.orderIntegrityMatches ? "Matches the paid checkout count." : "Does not match the paid checkout count."}</p></article>
          <article className="admin-overview-card"><span className="admin-card-kicker">Order value</span><strong>{gbp(metrics.recordedOrderValue)}</strong><h2>Recorded value before refunds</h2><p>{gbp(metrics.recordedProductValue)} products · {gbp(metrics.recordedDeliveryValue)} delivery</p></article>
          <article className="admin-overview-card"><span className="admin-card-kicker">HolyHub</span><strong>{gbp(metrics.recordedHolyHubCommission)}</strong><h2>Recorded commission</h2><p>5% product-subtotal commission recorded on paid orders.</p></article>
          <article className="admin-overview-card"><span className="admin-card-kicker">Payment data</span><strong>{percent(metrics.stripeFeeCoverage)}</strong><h2>Stripe fee coverage</h2><p>Share of paid orders with a Stripe processing fee recorded.</p></article>
        </div>
        <div className="card">
          <h2>Seller-order fulfilment</h2>
          <p>{metrics.fulfilment.pending} received · {metrics.fulfilment.packed} processing · {metrics.fulfilment.dispatched} dispatched · {metrics.fulfilment.delivered} delivered · {metrics.fulfilment.cancelled} cancelled</p>
        </div>
      </>}
      <p className="muted-small">This deliberately measures trustworthy checkout/order records only. It does not claim website visits, product views or browse-to-buy conversion because HolyHub does not currently record those events.</p>
    </section>
  );
}
