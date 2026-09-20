import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";
import { isUuid } from "@/lib/businesses";
import { money,statusLabel } from "@/lib/marketplace";
import { MarketNav } from "@/components/market-nav";
export default async function AdminOrder({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;if(!isUuid(id))notFound();
 const {supabase}=await requireRole("admin");
 const {data:order,error}=await supabase.from("orders").select("*").eq("id",id).maybeSingle();
 if(error)throw new Error("Order unavailable");if(!order)notFound();
 const [{data:items,error:itemError},{data:allocations,error:allocationError},{data:events,error:eventError}]=await Promise.all([
  supabase.from("order_items").select("*").eq("order_id",id),
  supabase.from("seller_orders").select("*").eq("order_id",id),
  supabase.from("payment_events").select("*").eq("order_id",id)
 ]);
 if(itemError||allocationError||eventError)throw new Error("Order records unavailable");
 return <><MarketNav area="admin"/><Link className="text-link" href="/admin/marketplace?view=orders">← All orders</Link><div className="section-heading"><p className="eyebrow">Order {id.slice(0,8).toUpperCase()}</p><h1 className="page-title">The full order picture.</h1><span className="status-pill">{statusLabel(order.status)}</span><p className="wrap-anywhere">Customer reference: {order.customer_id}</p></div>
 <div className="record-list">{allocations.map(s=><section className="card" key={s.id}><h2>Seller allocation</h2><p className="muted-small wrap-anywhere">Business reference: {s.business_id}</p>{items.filter(i=>i.seller_order_id===s.id).map(i=><div className="meta-row" key={i.id}><span>{i.quantity} × {i.product_name}</span><strong>{money(i.total_pence)}</strong></div>)}<p>Items {money(s.gross_pence)} · Commission {money(s.commission_pence)}</p><p>Reserve: {s.reserve_pence===null?"Not allocated":money(s.reserve_pence)} · Transferred: {money(s.transferred_pence)} · Refunded: {money(s.refunded_pence)}</p><p>Fulfilment: {statusLabel(s.fulfillment_status)}</p>{s.tracking_note&&<p className="preserve-lines">{s.tracking_note}</p>}</section>)}</div>
 <section className="card top-space"><h2>Verified payment events</h2>{events.length?events.map(e=><p key={e.event_id} className="wrap-anywhere">{e.event_type} · {e.event_id}</p>):<p>No verified payment event is recorded for this order.</p>}<p className="notice notice-info">This screen cannot mark an order paid, send a refund or release seller funds.</p></section></>;
}
