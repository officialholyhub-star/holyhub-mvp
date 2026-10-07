import Link from "next/link";
import styles from "./page.module.css";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateSellerFulfilment } from "./actions";
import { CARRIERS, formatDeliveryAddress, FULFILMENT_STATUS_LABELS, FULFILMENT_STATUSES } from "@/lib/fulfilment";

export const dynamic = "force-dynamic";

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

type SearchParams = { error?: string; message?: string };

export default async function ListerOrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { supabase, user } = await requireRole("lister");
  const { data: sellerOrders, error } = await supabase
    .from("seller_orders")
    .select("id, order_id, seller_business_name, product_subtotal, delivery_total, total_amount, holyhub_commission, stripe_processing_fee, seller_payout_amount, fulfilment_status, carrier, carrier_other, tracking_number, tracking_url, dispatched_at, fulfilment_note, orders(user_id, created_at, delivery_recipient_name, delivery_address_line1, delivery_address_line2, delivery_city, delivery_postcode, delivery_country)")
    .eq("seller_user_id", user.id)
    .order("created_at", { ascending: false });
  const orderIds = (sellerOrders ?? []).map((order) => order.order_id);
  const { data: items } = orderIds.length
    ? await supabase.from("order_items").select("order_id, product_name, quantity, variant_size, unit_amount, line_total").eq("seller_user_id", user.id).in("order_id", orderIds)
    : { data: [] };
  const customerIds = [...new Set((sellerOrders ?? []).map((order) => {
    const orderRecord = Array.isArray(order.orders) ? order.orders[0] : order.orders;
    return orderRecord?.user_id;
  }).filter((id): id is string => Boolean(id)))];
  const admin = createAdminClient();
  const { data: profiles } = customerIds.length ? await admin.from("profiles").select("id, full_name").in("id", customerIds) : { data: [] };
  const customers = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name ?? "Customer"]));
  const emails = new Map<string, string>();
  await Promise.all(customerIds.map(async (customerId) => {
    const result = await admin.auth.admin.getUserById(customerId);
    if (result.data.user?.email) emails.set(customerId, result.data.user.email);
  }));
  const itemsByOrder = new Map<string, typeof items>();
  for (const item of items ?? []) itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), item]);

  return (
    <section className="lister-orders-page">
      <div className="page-heading">
        <div><p className="eyebrow">Lister space</p><h1>Orders</h1><p className="lead">Prepare your orders and keep customers updated.</p></div>
        <div className="order-export-actions"><a className="button button-primary" href="/lister/orders/export?scope=unfulfilled">Export unfulfilled</a><form id="selected-order-export" method="get" action="/lister/orders/export"><input type="hidden" name="scope" value="selected" /><button className="button button-quiet" type="submit">Export selected</button></form></div>
      </div>
      {params.error && <p className="notice notice-error" role="alert">{params.error}</p>}
      {params.message && <p className="notice notice-success" role="status">{params.message}</p>}
      {error ? <div className="notice notice-error">Orders could not be loaded.</div> : sellerOrders?.length ? (
        <div className="lister-order-list">
          {sellerOrders.map((sellerOrder) => {
            const orderRecord = Array.isArray(sellerOrder.orders) ? sellerOrder.orders[0] : sellerOrder.orders;
            const customerId = orderRecord?.user_id;
            const orderItems = itemsByOrder.get(sellerOrder.order_id) ?? [];
            return (
              <article className="lister-order-card" key={sellerOrder.id}>
                <div className="lister-order-header">
                  <div><label className="order-select"><input type="checkbox" aria-label={`Select order ${sellerOrder.order_id.slice(0, 8)}`} name="ids" value={sellerOrder.id} form="selected-order-export" /><span><p className="eyebrow">Order {sellerOrder.order_id.slice(0, 8)}</p><h2>{customers.get(customerId ?? "") ?? "Customer"}</h2></span></label><p>{emails.get(customerId ?? "") ?? ""} · {orderRecord?.created_at ? new Date(orderRecord.created_at).toLocaleDateString("en-GB") : ""}</p>{orderRecord && <p className="order-delivery-address">{formatDeliveryAddress(orderRecord)}</p>}</div>
                  <span className={`status-pill status-${sellerOrder.fulfilment_status}`}>{FULFILMENT_STATUS_LABELS[sellerOrder.fulfilment_status as keyof typeof FULFILMENT_STATUS_LABELS] ?? sellerOrder.fulfilment_status}</span>
                </div>
                <dl className={styles.financialSummary} aria-label="Your portion of this order">
                  <div><dt>Products</dt><dd>{gbp.format(sellerOrder.product_subtotal / 100)}</dd></div>
                  <div><dt>Delivery paid by customer</dt><dd>+{gbp.format(sellerOrder.delivery_total / 100)}</dd></div>
                  <div><dt>Customer paid</dt><dd>{gbp.format(sellerOrder.total_amount / 100)}</dd></div>
                  <div><dt>HolyHub commission (5%)</dt><dd>−{gbp.format(sellerOrder.holyhub_commission / 100)}</dd></div>
                  <div><dt>Stripe processing</dt><dd>{sellerOrder.stripe_processing_fee === null ? "Pending" : `−${gbp.format(sellerOrder.stripe_processing_fee / 100)}`}</dd></div>
                  <div className={styles.payout}><dt>Your payout</dt><dd>{sellerOrder.seller_payout_amount === null ? "Pending" : gbp.format(sellerOrder.seller_payout_amount / 100)}</dd></div>
                </dl>
                <div className="lister-order-items">
                  {orderItems.map((item, index) => <div className="lister-order-item" key={`${item.product_name}-${index}`}><span>{item.product_name}{item.variant_size ? ` · Size ${item.variant_size}` : ""}</span><strong>× {item.quantity}</strong></div>)}
                </div>
                <form className="fulfilment-form" action={updateSellerFulfilment}>
                  <input type="hidden" name="seller_order_id" value={sellerOrder.id} />
                  <label><span>Status</span><select name="fulfilment_status" defaultValue={sellerOrder.fulfilment_status}>{FULFILMENT_STATUSES.map((status) => <option key={status} value={status}>{FULFILMENT_STATUS_LABELS[status]}</option>)}</select></label>
                  <label><span>Carrier</span><select name="carrier" defaultValue={sellerOrder.carrier ?? ""}><option value="">Not selected</option>{CARRIERS.map((carrier) => <option key={carrier} value={carrier}>{carrier}</option>)}</select></label>
                  <label><span>Other carrier name</span><input name="carrier_other" defaultValue={sellerOrder.carrier_other ?? ""} maxLength={100} /></label>
                  <label><span>Tracking number</span><input name="tracking_number" defaultValue={sellerOrder.tracking_number ?? ""} maxLength={150} /></label>
                  <label><span>Tracking URL</span><input name="tracking_url" type="url" defaultValue={sellerOrder.tracking_url ?? ""} maxLength={500} /></label>
                  <label className="fulfilment-note-field"><span>Internal fulfilment note</span><textarea name="fulfilment_note" defaultValue={sellerOrder.fulfilment_note ?? ""} maxLength={1000} rows={2} /></label>
                  <button className="button button-primary" type="submit">Save fulfilment</button>
                </form>
              </article>
            );
          })}
        </div>
      ) : <div className="card empty-state"><p>No seller orders yet.</p><Link className="button button-primary" href="/lister">Back to lister space</Link></div>}
    </section>
  );
}
