import { readAllRows } from "@/lib/read-all-rows";
import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { FULFILMENT_STATUS_LABELS, isFulfilmentStatus, formatDeliveryAddress } from "@/lib/fulfilment";
import { orderPresentation } from "@/lib/order-presentation";
import { decodeDisplayText } from "@/lib/display-text";
export const dynamic = "force-dynamic";
const gbp = (amount: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount / 100);
export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; lister?: string; order?: string; page?: string }> }) {
  const params = await searchParams;
  const { supabase } = await requireRole("admin");
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.page ?? "1", 10) || 1));
  let query = supabase.from("seller_orders").select("id, order_id, seller_user_id, seller_business_name, total_amount, seller_amount, holyhub_commission, order_status, fulfilment_status, carrier, carrier_other, tracking_number, tracking_url, dispatched_at, delivered_at, fulfilment_note, created_at, updated_at, orders(order_status, cancelled_at, delivery_recipient_name, delivery_address_line1, delivery_address_line2, delivery_city, delivery_postcode, delivery_country)", { count: "exact" }).order("created_at", { ascending: false }).order("id");
  if (params.status && isFulfilmentStatus(params.status)) query = query.eq("fulfilment_status", params.status);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (params.lister && uuid.test(params.lister)) query = query.eq("seller_user_id", params.lister);
  if (params.order && uuid.test(params.order)) query = query.eq("order_id", params.order);
  const { data: orders, error, count } = await query.range((page - 1) * 50, page * 50 - 1);
  const ids = [...new Set((orders ?? []).map(order => order.order_id))];
  const items = ids.length ? await readAllRows(offset => supabase.from("order_items").select("order_id, seller_user_id, product_name, quantity, line_total, variant_size").in("order_id", ids).order("id").range(offset, offset + 999)) : { data: [], error: null };
  function pageUrl(next: number) { const search = new URLSearchParams(); for (const key of ["status", "lister", "order"] as const) if (params[key]) search.set(key, params[key]!); search.set("page", String(next)); return `/admin/orders?${search}`; }
  return <section className="admin-workspace"><p className="eyebrow">HolyHub admin</p><h1>Orders & fulfilment</h1><p>Each card shows one lister’s portion of a marketplace order.</p><nav className="admin-tabs" aria-label="Admin workspace"><Link href="/admin">Overview</Link><Link href="/admin/listers">Listers</Link><Link href="/admin/orders" aria-current="page">Orders</Link></nav>
    <form className="form" method="get"><label htmlFor="order-status">Fulfilment status</label><select id="order-status" name="status" defaultValue={params.status ?? ""}><option value="">All</option>{Object.entries(FULFILMENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{params.lister && <input type="hidden" name="lister" value={params.lister} />}{params.order && <input type="hidden" name="order" value={params.order} />}<button className="button button-secondary">Filter orders</button><Link href="/admin/orders">Clear filters</Link></form>
    <p className="notice notice-info">Historical orders have no saved dispatch promise. Overdue deadlines and refund status cannot yet be verified here. Cancelled does not confirm a refund.</p>
    {error || items.error ? <p className="notice notice-error" role="alert">Orders could not be loaded. Please try again.</p> : <div className="lister-order-list">{orders?.map(order => {
      const parent = Array.isArray(order.orders) ? order.orders[0] : order.orders;
      const state = orderPresentation(order.fulfilment_status, parent?.order_status ?? order.order_status);
      return <article className={`lister-order-card order-tone-${state.tone}`} key={order.id}><h2><Link href={`/admin/orders?order=${order.order_id}`}>Order {order.order_id.slice(0, 8)}</Link></h2><span className="status-pill">{state.label}</span><p>{decodeDisplayText(order.seller_business_name)} · {new Date(order.created_at).toLocaleDateString("en-GB")} · {gbp(order.total_amount)}</p><p>{decodeDisplayText(parent?.delivery_recipient_name ?? "Customer")}</p><ul>{items.data?.filter(item => item.order_id === order.order_id && item.seller_user_id === order.seller_user_id).map((item, index) => <li key={index}>{decodeDisplayText(item.product_name)}{item.variant_size ? ` · ${decodeDisplayText(item.variant_size)}` : ""} × {item.quantity} · {gbp(item.line_total)}</li>)}</ul>
        <details open={Boolean(params.order)}><summary>Order details</summary><p>Reference: {order.order_id}</p><p>Payment / order state: {parent?.order_status ?? order.order_status}</p><p>Delivery: {parent ? decodeDisplayText(formatDeliveryAddress(parent)) : "Unavailable"}</p><p>Lister payout: {gbp(order.seller_amount)} · HolyHub fee: {gbp(order.holyhub_commission)}</p><p>Carrier: {order.carrier === "Other" ? order.carrier_other : order.carrier || "Not recorded"} · Tracking: {order.tracking_number || "Not recorded"}</p>{order.tracking_url && /^https?:\/\//i.test(order.tracking_url) && <p><a href={order.tracking_url} target="_blank" rel="noopener noreferrer">Open tracking link</a></p>}<p>Dispatched: {order.dispatched_at ? new Date(order.dispatched_at).toLocaleString("en-GB") : "Not recorded"} · Delivered: {order.delivered_at ? new Date(order.delivered_at).toLocaleString("en-GB") : "Not recorded"}</p>{order.fulfilment_note && <p>{decodeDisplayText(order.fulfilment_note)}</p>}{parent?.cancelled_at && <p>Cancelled: {new Date(parent.cancelled_at).toLocaleString("en-GB")}</p>}<p>Last order update: {new Date(order.updated_at).toLocaleString("en-GB")}</p></details></article>;
    })}{!orders?.length && <div className="card empty-state">
      {page > 1 ? <><h2>No orders on this page.</h2><Link className="button button-primary" href={pageUrl(1)}>Return to first page</Link></> : params.status && isFulfilmentStatus(params.status) || params.lister && uuid.test(params.lister) || params.order && uuid.test(params.order) ? <><h2>No orders match these filters.</h2><Link className="button button-primary" href="/admin/orders">Clear filters</Link></> : <><h2>No orders yet.</h2><p>Paid orders will appear here.</p><Link href="/admin">Return to overview</Link></>}
    </div>}</div>}
    <nav className="button-row" aria-label="Order pages">{page > 1 && <Link href={pageUrl(page - 1)}>Previous</Link>}<span>Page {page}</span>{page * 50 < (count ?? 0) && <Link href={pageUrl(page + 1)}>Next</Link>}</nav>
  </section>;
}
