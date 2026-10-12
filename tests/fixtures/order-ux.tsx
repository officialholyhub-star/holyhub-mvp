// Isolated UI fixture: no auth, database or payment requests.
import { createRoot } from "react-dom/client";
import { FulfilmentSummary } from "../../components/fulfilment-summary";
import { FulfilmentStatusBadge } from "../../components/fulfilment-status-badge";
import { OrderUpdatePanel } from "../../components/order-update-panel";
import { HelpIcon } from "../../components/help-icon";
import { LISTING_HELP, LISTING_STATUS_LABELS } from "../../lib/help-copy";
import { OrderExportTools } from "../../components/order-export-tools";
import { decodeDisplayText } from "../../lib/display-text";
import "../../app/globals.css";
import "../../app/visual-polish.css";

declare global { interface Window { savedOrder?: Record<string, FormDataEntryValue> } }

const emptyTracking = new URLSearchParams(window.location.search).has("empty");
const order = { id: "test-order", fulfilment_status: new URLSearchParams(window.location.search).get("status") ?? "pending", carrier: "Royal Mail", carrier_other: "Local courier", tracking_number: emptyTracking ? null : "TRACK123", tracking_url: emptyTracking ? null : "https://example.com/track", created_at: "2026-10-01T10:00:00Z", dispatched_at: "2026-10-02T10:00:00Z", delivered_at: "2026-10-03T10:00:00Z", fulfilment_note: "Pack carefully" };

createRoot(document.getElementById("root")!).render(
  <main className="page-shell">
    <section className="lister-orders-page">
      <div className="page-heading"><div><p className="eyebrow">Lister space</p><h1>Orders</h1><p className="lead">Prepare your orders and keep customers updated.</p></div></div>
      <FulfilmentSummary summary={{ toFulfil: 3, unfulfilled: 2, processing: 1, dispatched: 3, completed: 4 }} compact />
      <OrderExportTools>
      <div className="lister-order-list">
      <article className="lister-order-card">
        <div className="lister-order-header"><label className="order-reference-row"><input type="checkbox" aria-label="Select order 12345678 for export" name="ids" value="test-order" form="selected-order-export" /><span className="order-reference">Order 12345678</span></label><FulfilmentStatusBadge status={order.fulfilment_status} /></div>
        <div className="order-customer-meta"><span>Customer A</span><span>05/10/2026</span></div>
        <div className="lister-order-items"><div className="lister-order-item"><span>{decodeDisplayText("HolyHu&#x62; van&#x73;")} · Size M</span><strong>× 2</strong></div><div data-testid="unsafe-name">{decodeDisplayText("&lt;img src=x onerror=window.__xss=1&gt;")}</div></div>
        <div className="order-delivery-summary"><span className="order-section-label">Deliver to</span><p>Recipient<br /><span>London, SW1A 1AA</span></p></div>
        <OrderUpdatePanel order={order} action={async data => { window.savedOrder = Object.fromEntries(data); }} deliveryAddress="Recipient, 10 Real Road, Flat 2, London, SW1A 1AA, GB" />
      </article>
      </div>
      </OrderExportTools>
      <section style={{ marginTop: 32 }}><h2>Listing status help</h2><div className="row-actions">{Object.entries(LISTING_STATUS_LABELS).map(([key, label]) => <span className="status-with-help" key={key}><span className={`status-pill status-${key}`}>{label}</span><HelpIcon label={label} text={LISTING_HELP[key as keyof typeof LISTING_HELP]} /></span>)}</div></section>
    </section>
  </main>
);
