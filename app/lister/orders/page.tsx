import { ClearDraft } from "@/components/draft-form";
import { orderPresentation } from "@/lib/order-presentation";
import Link from "next/link";
import styles from "./page.module.css";
import { FulfilmentSummary } from "@/components/fulfilment-summary";
import { getSellerFulfilmentSummary } from "@/lib/fulfilment-summary";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateSellerFulfilment } from "./actions";
import { formatDeliveryAddress } from "@/lib/fulfilment";
import { decodeDisplayText } from "@/lib/display-text";
import { OrderUpdatePanel } from "@/components/order-update-panel";
import { FulfilmentStatusBadge } from "@/components/fulfilment-status-badge";
import { OrderExportTools } from "@/components/order-export-tools";

export const dynamic = "force-dynamic";

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

type SearchParams = { error?: string; message?: string; saved_edits?: string };

export default async function ListerOrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { supabase, user } = await requireRole("lister");
  const fulfilmentSummary = await getSellerFulfilmentSummary(supabase, user.id);
  const { data: sellerOrders, error } = await supabase
    .from("seller_orders")
    .select("id, order_id, seller_business_name, total_amount, holyhub_commission, seller_amount, fulfilment_status, carrier, carrier_other, tracking_number, tracking_url, dispatched_at, delivered_at, created_at, fulfilment_note, updated_at, orders(user_id, created_at, delivery_recipient_name, delivery_address_line1, delivery_address_line2, delivery_city, delivery_postcode, delivery_country)")
    .eq("seller_user_id", user.id)
    .order("created_at", { ascending: false });
  const orderIds = (sellerOrders ?? []).map((order) => order.order_id);
  const { data: items, error: itemsError } = orderIds.length
    ? await supabase.from("order_items").select("order_id, product_name, quantity, variant_size, unit_amount, line_total").eq("seller_user_id", user.id).in("order_id", orderIds)
    : { data: [], error: null };
  const customerIds = [...new Set((sellerOrders ?? []).map((order) => {
    const orderRecord = Array.isArray(order.orders) ? order.orders[0] : order.orders;
    return orderRecord?.user_id;
  }).filter((id): id is string => Boolean(id)))];
  const admin = createAdminClient();
  const { data: profiles, error: profilesError } = customerIds.length ? await admin.from("profiles").select("id, full_name").in("id", customerIds) : { data: [], error: null };
  const customers = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name ?? "Customer"]));
  const itemsByOrder = new Map<string, typeof items>();
  for (const item of items ?? []) itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), item]);

  return (
    <section className="lister-orders-page">
      <div className="page-heading">
        <div><p className="eyebrow">Lister space</p><h1>Orders</h1><p className="lead">Prepare your orders and keep customers updated.</p></div>
      </div>
      {params.error && <p className="notice notice-error" role="alert">{params.error}</p>}
      <FulfilmentSummary summary={fulfilmentSummary} compact />
      {params.saved_edits && <ClearDraft draftKey={`hh-order-edits-${user.id}-${params.saved_edits}`} />}
      {params.message && <p className="notice notice-success" role="status">{params.message}</p>}
      {(itemsError || profilesError) && <p role="alert" className="notice notice-error">Some order details could not be loaded. Refresh before preparing an order.</p>}
      <OrderExportTools disabled={Boolean(error || itemsError || !sellerOrders?.length)}>
      {error ? <div className="notice notice-error">Orders could not be loaded.</div> : sellerOrders?.length ? (
        <div className="lister-order-list">
          {sellerOrders.map((sellerOrder) => {
            const orderRecord = Array.isArray(sellerOrder.orders) ? sellerOrder.orders[0] : sellerOrder.orders;
            const customerId = orderRecord?.user_id;
            const orderItems = itemsByOrder.get(sellerOrder.order_id) ?? [];
            return (
              <article className={`lister-order-card order-tone-${orderPresentation(sellerOrder.fulfilment_status).tone}`} key={sellerOrder.id}>
                <div className="lister-order-header">
                  <label className="order-reference-row"><input type="checkbox" aria-label={`Select order ${sellerOrder.order_id.slice(0, 8)} for export`} name="ids" value={sellerOrder.id} form="selected-order-export" /><span className="order-reference">Order {sellerOrder.order_id.slice(0, 8)}</span></label>
                  <FulfilmentStatusBadge status={sellerOrder.fulfilment_status} />
                </div>
                <div className="order-customer-meta"><span>{decodeDisplayText(customers.get(customerId ?? "") ?? "Customer")}</span><span>{orderRecord?.created_at ? new Date(orderRecord.created_at).toLocaleDateString("en-GB") : ""}</span></div>
                <dl className={styles.financialSummary} aria-label="Your portion of this order">
                  <div><dt>Customer paid</dt><dd>{gbp.format(sellerOrder.total_amount / 100)}</dd></div>
                  <div><dt>HolyHub fee</dt><dd>{gbp.format(sellerOrder.holyhub_commission / 100)}</dd></div>
                  <div className={styles.payout}><dt>Your payout</dt><dd>{gbp.format(sellerOrder.seller_amount / 100)}</dd></div>
                </dl>
                <div className="lister-order-items">
                  {orderItems.map((item, index) => <div className="lister-order-item" key={`${item.product_name}-${index}`}><span>{decodeDisplayText(item.product_name)}{item.variant_size ? ` · Size ${decodeDisplayText(item.variant_size)}` : ""}</span><strong>× {item.quantity}</strong></div>)}
                </div>
                {orderRecord && <div className="order-delivery-summary"><span className="order-section-label">Deliver to</span><p>{decodeDisplayText(orderRecord.delivery_recipient_name ?? customers.get(customerId ?? "") ?? "Customer")}<br /><span>{decodeDisplayText([orderRecord.delivery_city, orderRecord.delivery_postcode].filter(Boolean).join(", "))}</span></p></div>}
                {!itemsError && <OrderUpdatePanel draftOwner={user.id} recoverEdits={Boolean(params.error)} key={`${sellerOrder.id}:${sellerOrder.updated_at}`} order={sellerOrder} action={updateSellerFulfilment} deliveryAddress={orderRecord ? decodeDisplayText(formatDeliveryAddress(orderRecord)) : ""} />}
              </article>
            );
          })}
        </div>
      ) : <div className="card empty-state"><h2>No orders yet</h2><p>Paid orders will appear here.</p><Link className="button button-primary" href="/lister/products">View your products</Link></div>}
      </OrderExportTools>
    </section>
  );
}
