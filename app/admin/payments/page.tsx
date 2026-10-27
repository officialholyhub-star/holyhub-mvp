import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { managePayments } from "./actions";
export const dynamic = "force-dynamic";
export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; seller_order?: string }> }) {
  await requireRole("admin");
  const params = await searchParams;
  const admin = createAdminClient();
  const [weekly, debt, operations, shortfalls, reconciliation, feeCredits, feeWeekly, feeV2, feeWeeklyV2, feeExceptions, feeAllocations] = await Promise.all([
    admin.from("payment_weekly_metrics").select("*").order("week_start_london", { ascending: false }).limit(12),
    admin.from("seller_debt_metrics").select("*"),
    admin.from("payment_operations").select("id,kind,amount,status,stripe_id,failure_code,created_at").order("created_at", { ascending: false }).limit(100),
    admin.from("seller_debt_weekly_metrics").select("*").order("week_start_london", { ascending: false }).limit(12),
    admin.from("payment_reconciliation").select("*").order("order_id").limit(100),
    admin.from("processing_fee_credit_reconciliation").select("*").order("created_at", { ascending: false }).limit(100),
    admin.from("processing_fee_credit_weekly_metrics").select("*").order("week_start_london", { ascending: false }).limit(12),
    admin.from("processing_fee_reconciliation_v2").select("*").order("recognized_at", { ascending: false }).limit(100),
    admin.from("processing_fee_weekly_metrics_v2").select("*").order("week_start_london", { ascending: false }).limit(12),
    admin.from("processing_fee_review_exceptions").select("*").order("created_at", { ascending: false }).limit(100),
    admin.from("processing_fee_allocation_reconciliation_v2").select("*").order("allocation_id").limit(100),
  ]);
  const sellerOrder = params.seller_order && /^[0-9a-f-]{36}$/i.test(params.seller_order)
    ? await admin.from("seller_orders").select("id,order_id,seller_user_id,seller_business_name,product_subtotal,delivery_total").eq("id", params.seller_order).maybeSingle() : null;
  const items = sellerOrder?.data ? await admin.from("order_items").select("id,product_name,variant_size,quantity,line_total")
    .eq("order_id", sellerOrder.data.order_id).eq("seller_user_id", sellerOrder.data.seller_user_id) : null;
  return <section className="section-wrap"><h1>Payments and refunds</h1>
    <p>Amounts below are in pence. Review evidence and responsibility before requesting a refund. Cancellation alone does not confirm a completed customer refund.</p>
    {params.error && <p role="alert">{params.error}</p>}{params.message && <p role="status">{params.message}</p>}
    {(weekly.error || debt.error || operations.error || shortfalls.error || reconciliation.error || feeCredits.error || feeWeekly.error || feeV2.error || feeWeeklyV2.error || feeExceptions.error || feeAllocations.error) && <p role="alert">Financial records could not be loaded. Do not infer that balances are zero.</p>}
    <form action={managePayments}><input type="hidden" name="action" value="run" /><button>Process and reconcile payments</button></form>
    <h2>Weekly monitoring</h2><pre>{JSON.stringify(weekly.data, null, 2)}</pre>
    <h2>Weekly funded shortfalls</h2><pre>{JSON.stringify(shortfalls.data, null, 2)}</pre>
    <h2>Reconciliation</h2><pre>{JSON.stringify(reconciliation.data, null, 2)}</pre>
    <h2>HolyHub-funded processing-fee credits</h2>
    <p>Original provider fees and seller allocated fees remain unchanged. These separate HolyHub obligations show the originating refund, reason, responsibility, seller and allocation. Recognized credit equals paid plus outstanding payable credit; attention amounts remain outstanding.</p>
    <pre>{JSON.stringify(feeCredits.data, null, 2)}</pre>
    <h3>Weekly processing-fee credits</h3><pre>{JSON.stringify(feeWeekly.data, null, 2)}</pre>
    <h3>Proportionate fee assessments</h3>
    <p>Assessed amounts preserve the original responsibility calculation. Current entitlement, provider reimbursements, reservations and paid amounts are shown separately. Review exceptions before further payment.</p>
    <pre>{JSON.stringify(feeV2.data, null, 2)}</pre>
    <h3>Current fee obligations by seller allocation</h3><pre>{JSON.stringify(feeAllocations.data, null, 2)}</pre>
    <h3>Weekly fee assessment and reimbursement events</h3><pre>{JSON.stringify(feeWeeklyV2.data, null, 2)}</pre>
    <h3>Provider reimbursement exceptions</h3><pre>{JSON.stringify(feeExceptions.data, null, 2)}</pre>
    <details><summary>Record a verified provider fee refund or rebate</summary>
      <form action={managePayments} className="form">
        <input type="hidden" name="action" value="rebate" />
        <label>Refund operation reference<input name="refund_operation_id" required /></label>
        <label>Unique provider reimbursement reference<input name="provider_reference" required maxLength={200} /></label>
        <label>Applicable seller fee reimbursed (£)<input name="rebate_amount" type="number" min="0.01" step="0.01" required /></label>
        <label>Provider evidence<textarea name="evidence" required maxLength={1000} /></label>
        <label><input type="checkbox" name="verified" value="yes" required />I verified this provider reimbursement and its seller/refund attribution.</label>
        <button>Record provider reimbursement</button>
      </form>
    </details>
    <h2>Seller debt</h2><pre>{JSON.stringify(debt.data, null, 2)}</pre>
    <h2>Recent operations</h2><pre>{JSON.stringify(operations.data, null, 2)}</pre>
    <details><summary>Verify seller payout account</summary><form action={managePayments} className="form">
      <input type="hidden" name="action" value="account" />
      <label>Seller user reference<input name="seller_user_id" required /></label>
      <label>Connected Stripe account reference<input name="stripe_account_id" required pattern="acct_.*" /></label>
      <button>Verify and save account</button></form></details>
    <h2>Request a verified refund</h2>
    <p><Link href="/admin/orders">Choose the seller portion from admin orders</Link>, or enter its reference below.</p>
    <form method="get"><label>Seller order portion reference<input name="seller_order" required defaultValue={params.seller_order} /></label><button>Load purchased items</button></form>
    {(sellerOrder?.error || items?.error || (params.seller_order && !sellerOrder?.data)) && <p role="alert">Seller portion or purchased items could not be loaded.</p>}
    {sellerOrder?.data && items?.data && <form action={managePayments} className="form">
      <input type="hidden" name="action" value="refund" />
      <input type="hidden" name="seller_order_id" value={sellerOrder.data.id} />
      <h3>{sellerOrder.data.seller_business_name}</h3>
      <label>Unique support case reference (reuse for retries)<input name="request_key" required maxLength={200} /></label>
      {items.data.map(item => <fieldset key={item.id}><legend>{item.product_name}{item.variant_size ? ` (${item.variant_size})` : ""} — {item.quantity} purchased</legend>
        <p>Purchased product value: £{(item.line_total / 100).toFixed(2)}</p>
        <label>Product refund (£)<input name={`item_amount_${item.id}`} type="number" min="0" max={item.line_total / 100} step="0.01" defaultValue="0" required /></label>
        <label>Verified sellable units to restore<input name={`restore_${item.id}`} type="number" min="0" max={item.quantity} step="1" defaultValue="0" required /></label>
      </fieldset>)}
      <p>Leave stock restoration at zero for faulty or damaged goods unless their sellability is verified. Earlier refunds are checked before anything is queued.</p>
      <label>Delivery refund (£)<input name="delivery" type="number" min="0" max={sellerOrder.data.delivery_total / 100} step="0.01" defaultValue="0" required /></label>
      <label>Evidence and reason<textarea name="reason" required maxLength={1000} /></label>
      <label>Verified customer-refund settlement responsibility<select name="responsibility"><option value="seller">Seller</option><option value="holyhub">HolyHub</option></select></label>
      <label>HolyHub processing-fee responsibility (basis points)<input name="fee_responsibility_bps" type="number" min="0" max="10000" step="1" required /></label>
      <p>0 means seller responsibility, 10000 means HolyHub responsibility; intermediate values record a shared processing-fee responsibility. This assessment does not change customer-refund settlement responsibility.</p>
      <label><input type="checkbox" name="verified" value="yes" required />I verified the refund due, affected seller/items, amount, responsibility and stock decision.</label>
      <button>Queue refund</button></form>}
  </section>;
}
