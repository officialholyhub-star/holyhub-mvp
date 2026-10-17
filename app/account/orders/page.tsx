import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { formatDeliveryAddress, FULFILMENT_STATUS_LABELS, type FulfilmentStatus } from "@/lib/fulfilment";
import { decodeDisplayText } from "@/lib/display-text";

function safeTrackingUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

export default async function AccountOrdersPage() {
  const { supabase, user } = await requireUser();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, created_at, total_amount, order_status, delivery_recipient_name, delivery_address_line1, delivery_address_line2, delivery_city, delivery_postcode, delivery_country, seller_orders(id, seller_user_id, seller_business_name, fulfilment_status, carrier, carrier_other, tracking_number, tracking_url, dispatched_at)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const orderIds = (orders ?? []).map((order) => order.id);
  const { data: orderItems, error: itemsError } = orderIds.length ? await supabase.from("order_items").select("order_id, seller_user_id, product_name, quantity, variant_size").in("order_id", orderIds) : { data: [], error: null };
  const itemsByOrder = new Map<string, typeof orderItems>();
  for (const item of orderItems ?? []) itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), item]);

  return (
    <section className="customer-orders-page">
      <Link className="text-link" href="/account">Back to account</Link>
      <div className="page-heading"><div><p className="eyebrow">Your HolyHub space</p><h1>My orders</h1><p className="lead">Track your orders and delivery updates.</p></div></div>
      {itemsError && <p role="alert" className="notice notice-error">Some order items could not be loaded. Refresh to see complete order details.</p>}
      {error ? <p className="notice notice-error">Orders could not be loaded.</p> : orders?.length ? (
        <div className="customer-order-list">
          {orders.map((order) => (
            <article className="customer-order-card" key={order.id}>
              <div className="customer-order-header"><div><p className="eyebrow">Order {order.id.slice(0, 8)}</p><p>{new Date(order.created_at).toLocaleDateString("en-GB")}</p><p className="order-delivery-address">{formatDeliveryAddress(order)}</p></div><strong>£{(Number(order.total_amount) / 100).toFixed(2)}</strong></div>
              {(order.seller_orders ?? []).map((sellerOrder) => {
                const status = sellerOrder.fulfilment_status as FulfilmentStatus;
                const trackingUrl = safeTrackingUrl(sellerOrder.tracking_url);
                return (
                  <div className="customer-seller-order" key={sellerOrder.id}>
                    <div className="customer-seller-order-heading"><h2>{decodeDisplayText(sellerOrder.seller_business_name)}</h2><span className={`status-pill status-${status}`}>{status === "pending" ? "Awaiting preparation" : FULFILMENT_STATUS_LABELS[status] ?? status}</span></div>
                    {status === "cancelled" && <p>This order has been cancelled.</p>}
                    <div className="customer-order-items">{(itemsByOrder.get(order.id) ?? []).filter((item) => item.seller_user_id === sellerOrder.seller_user_id).map((item, index) => <p key={`${item.product_name}-${index}`}>{decodeDisplayText(item.product_name)}{item.variant_size ? ` · Size ${decodeDisplayText(item.variant_size)}` : ""} · Qty {item.quantity}</p>)}</div>
                    {sellerOrder.fulfilment_status === "dispatched" && !sellerOrder.tracking_number && !trackingUrl && <p>No tracking details have been added.</p>}
                    {(sellerOrder.carrier || sellerOrder.tracking_number || trackingUrl || sellerOrder.dispatched_at) && <div className="customer-tracking"><strong>Delivery</strong>{sellerOrder.carrier && <span>{sellerOrder.carrier === "Other" ? sellerOrder.carrier_other : sellerOrder.carrier}</span>}{sellerOrder.tracking_number && <span>Tracking: {sellerOrder.tracking_number}</span>}{sellerOrder.dispatched_at && <span>Dispatched {new Date(sellerOrder.dispatched_at).toLocaleDateString("en-GB")}</span>}{trackingUrl && <a href={trackingUrl} target="_blank" rel="noopener noreferrer">Open tracking link</a>}</div>}
                  </div>
                );
              })}
            </article>
          ))}
        </div>
      ) : <div className="card empty-state"><p>You have no orders yet.</p><Link className="button button-primary" href="/marketplace">Browse marketplace</Link></div>}
    </section>
  );
}
