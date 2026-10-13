"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { readDraft, writeDraft } from "@/lib/form-drafts";
import { unstable_rethrow } from "next/navigation";
import { useFormStatus } from "react-dom";
import { CARRIERS, LISTER_FULFILMENT_STATUS_LABELS, type FulfilmentStatus } from "@/lib/fulfilment";
import { OrderCancellation } from "./order-cancellation";
import styles from "./order-update-panel.module.css";

type Order = {
  id: string; fulfilment_status: string; carrier: string | null;
  carrier_other: string | null; tracking_number: string | null;
  tracking_url: string | null; fulfilment_note: string | null; dispatched_at?: string | null; delivered_at?: string | null; created_at?: string | null;
};

export function OrderUpdatePanel({ order, action, deliveryAddress, draftOwner = "lister", recoverEdits = false }: {
  order: Order; action: (formData: FormData) => Promise<void>;
  deliveryAddress: string; draftOwner?: string; recoverEdits?: boolean;
}) {
  const id = useId();
  const [delivery, setDelivery] = useState(false);
  const [editing, setEditing] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [carrier, setCarrier] = useState(order.carrier ?? "");
  const [carrierOther, setCarrierOther] = useState(order.carrier_other ?? "");
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number ?? "");
  const [trackingUrl, setTrackingUrl] = useState(order.tracking_url ?? "");
  const [note, setNote] = useState(order.fulfilment_note ?? "");
  const [copyMessage, setCopyMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const draftKey = `hh-order-edits-${draftOwner}-${order.id}`;
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const draft = readDraft(draftKey);
      if (!draft) return;
      setSaveError("Unsaved order details were recovered in this tab. Check the latest order before saving them.");
      setCarrier(draft.carrier?.[0] ?? order.carrier ?? ""); setCarrierOther(draft.carrier_other?.[0] ?? order.carrier_other ?? "");
      setTrackingNumber(draft.tracking_number?.[0] ?? order.tracking_number ?? ""); setTrackingUrl(draft.tracking_url?.[0] ?? order.tracking_url ?? ""); setNote(draft.fulfilment_note?.[0] ?? order.fulfilment_note ?? "");
      if (order.fulfilment_status === "packed") setDelivery(true);
      if (["dispatched", "delivered"].includes(order.fulfilment_status)) setEditing(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftKey, recoverEdits, order]);
  async function saveEdits(data: FormData) {
    writeDraft(draftKey, { carrier: [carrier], carrier_other: [carrierOther], tracking_number: [trackingNumber], tracking_url: [trackingUrl], fulfilment_note: [note] });
    setSaveError("");
    try { await action(data); }
    catch (error) { unstable_rethrow(error); setSaveError("We couldn’t confirm this update. Your edits are still here. Refresh and check the latest order before trying again."); }
  }
  const status = order.fulfilment_status;
  const showDelivery = (status === "packed" && delivery) || editing;
  const step = status === "delivered" ? 3 : status === "dispatched" ? 2 : delivery ? 1 : 0;
  const title = status === "pending" ? "Needs preparing" : status === "packed" ? delivery ? "Arrange delivery" : "Preparing" : status === "delivered" ? "Completed ✓" : status === "cancelled" ? "Cancelled" : "Dispatched";
  const helper = status === "pending" ? "Get the customer’s order ready to send." : status === "packed" ? delivery ? "Buy your shipping label with your chosen carrier, then add the tracking details below." : "Once the order is packed and ready, arrange delivery." : status === "dispatched" ? "The order is on its way to the customer." : status === "delivered" ? "This order has been delivered." : "This order has been cancelled.";

  function fields(nextStatus: string, intent = "status") {
    const data = new FormData();
    Object.entries({ seller_order_id: order.id, fulfilment_status: nextStatus, expected_status: status, intent, confirmed: "yes", carrier, carrier_other: carrierOther, tracking_number: trackingNumber, tracking_url: trackingUrl, fulfilment_note: note }).forEach(([key, value]) => data.set(key, value));
    return data;
  }
  function save(nextStatus: string, intent = "status") {
    const prompt = intent === "correction" ? `Correct this order to ${LISTER_FULFILMENT_STATUS_LABELS[nextStatus as FulfilmentStatus]}? The customer will see the corrected status.` : nextStatus === "delivered" ? "Mark this order as delivered?" : "";
    if (prompt && !window.confirm(prompt)) return;
    startTransition(async () => { await action(fields(nextStatus, intent)); });
  }
  const correctionStatuses = (status === "packed" ? ["pending"] : status === "dispatched" ? ["pending", "packed"] : status === "delivered" ? ["pending", "packed", "dispatched"] : []) as FulfilmentStatus[];

  return <section className={styles.panel} aria-label="Order journey" aria-busy={pending}>
    {status !== "cancelled" && <ol className={styles.progress} aria-label="Order progress">
      {["Preparing", "Delivery", "Dispatched", "Completed"].map((label, index) => <li key={label} aria-current={index === step ? "step" : undefined} data-reached={index <= step}><span>{index < step ? "✓" : index + 1}</span>{label}</li>)}
    </ol>}
    {saveError && <p role="alert" className="notice notice-error">{saveError}</p>}
    <h3>{title}</h3><p className={styles.helper}>{helper}</p>
    {deliveryAddress && <div className={styles.address}><strong>Delivery address</strong><p>{deliveryAddress}</p><button type="button" className="button button-quiet" onClick={async () => {
      try { await navigator.clipboard.writeText(deliveryAddress); setCopyMessage("Address copied."); }
      catch { setCopyMessage("Select the address above to copy it."); }
    }}>Copy address</button><span role="status">{copyMessage}</span></div>}
    {status === "pending" && <button disabled={pending} className="button button-primary" onClick={() => save("packed")}>Start preparing order</button>}
    {status === "packed" && !delivery && <button className="button button-primary" onClick={() => setDelivery(true)}>Ready to send</button>}
    {(status === "dispatched" || status === "delivered") && <div className={styles.delivery}>
      <dl>{order.carrier && <div><dt>Carrier</dt><dd>{order.carrier === "Other" ? order.carrier_other : order.carrier}</dd></div>}
      {order.tracking_number && <div><dt>Tracking number</dt><dd>{order.tracking_number}</dd></div>}
      {order.dispatched_at && <div><dt>Dispatched date</dt><dd>{new Date(order.dispatched_at).toLocaleDateString("en-GB")}</dd></div>}</dl>
      {!order.tracking_number && !order.tracking_url && <p>No tracking details added. You can add them later.</p>}
      {order.tracking_url && /^https?:\/\//i.test(order.tracking_url) && <a href={order.tracking_url} target="_blank" rel="noopener noreferrer">Track delivery</a>}
      <button type="button" className="button button-quiet" aria-expanded={editing} aria-controls={`${id}-delivery`} onClick={() => setEditing(!editing)}>{editing ? "Close delivery details" : "Edit delivery details"}</button>
    </div>}
    {status === "dispatched" && !editing && <button disabled={pending} className="button button-primary" onClick={() => save("delivered")}>Mark as delivered</button>}
    {showDelivery && <form id={`${id}-delivery`} className={styles.form} onSubmit={event => { if (!editing && !window.confirm("Mark this order as dispatched?")) event.preventDefault(); }} action={async () => { await saveEdits(fields(editing ? status : "dispatched", editing ? "delivery" : "status")); }}>
      {editing && <h4>Edit delivery details</h4>}
      <div className={styles.grid}>
        <div className={styles.field}><label htmlFor={`${id}-carrier`}>Delivery carrier</label><select id={`${id}-carrier`} value={carrier} onChange={event => setCarrier(event.target.value)}><option value="">Not selected</option>{CARRIERS.map(value => <option key={value}>{value}</option>)}</select></div>
        {carrier === "Other" && <div className={styles.field}><label htmlFor={`${id}-other`}>Other carrier name</label><input id={`${id}-other`} value={carrierOther} onChange={event => setCarrierOther(event.target.value)} required maxLength={100} /></div>}
        <div className={styles.field}><label htmlFor={`${id}-tracking`}>Tracking number (optional)</label><input id={`${id}-tracking`} value={trackingNumber} onChange={event => setTrackingNumber(event.target.value)} maxLength={150} /></div>
        <div className={styles.field}><label htmlFor={`${id}-url`}>Tracking URL (optional)</label><input id={`${id}-url`} type="url" value={trackingUrl} onChange={event => setTrackingUrl(event.target.value)} maxLength={500} placeholder="https://…" /></div>
      </div><DeliverySubmit editing={editing} />
    </form>}
    <details className={styles.secondary}><summary>More details</summary><form action={async () => { await saveEdits(fields(status, "note")); }} className={styles.form}><div className={styles.field}><label htmlFor={`${id}-note`}>Private note</label><p className={styles.helper}>Only you can see this note.</p><textarea id={`${id}-note`} value={note} onChange={event => setNote(event.target.value)} maxLength={1000} rows={2} /></div><NoteSubmit /></form></details>
    <details className={styles.secondary}><summary>Order timeline</summary>
      <ol className={styles.timeline}>
        <li>Order placed{order.created_at && <time dateTime={order.created_at}>{new Date(order.created_at).toLocaleString("en-GB")}</time>}</li>
        {status === "packed" && <li>Preparing <span>Current stage · preparing time not recorded</span></li>}
        {order.dispatched_at && <li>Dispatched<time dateTime={order.dispatched_at}>{new Date(order.dispatched_at).toLocaleString("en-GB")}</time></li>}
        {status === "dispatched" && !order.dispatched_at && <li>Dispatched <span>Current stage · dispatch time not recorded</span></li>}
        {status === "delivered" && !order.delivered_at && <li>Completed <span>Current stage · completion time not recorded</span></li>}
        {order.delivered_at && <li>Completed<time dateTime={order.delivered_at}>{new Date(order.delivered_at).toLocaleString("en-GB")}</time></li>}
        {status === "cancelled" && <li>Cancelled <span>Current stage · cancellation time not recorded</span></li>}
      </ol><p className={styles.helper}>Available order dates, not a complete change history.</p>
    </details>
    {status !== "cancelled" && <details className={styles.secondary}><summary>More options</summary>
      <div className={styles.options}>
        {correctionStatuses.length > 0 && <><button disabled={pending} type="button" className="button button-quiet" aria-expanded={correcting} aria-controls={`${id}-correction`} onClick={() => setCorrecting(!correcting)}>Correct order status</button>
          {correcting && <div id={`${id}-correction`} className={styles.correction}><p>Only correct a stage selected by mistake. Delivery details are kept. This does not change payments or issue a refund.</p>{correctionStatuses.map(value => <button key={value} disabled={pending} className="button button-quiet" onClick={() => save(value, "correction")}>Return to {LISTER_FULFILMENT_STATUS_LABELS[value]}</button>)}</div>}</>}
        {(status === "pending" || status === "packed") && <OrderCancellation disabled={pending} action={async cancellation => {
          const data = fields("cancelled"); cancellation.forEach((value, key) => data.set(key, value)); await action(data);
        }} />}
        {(status === "dispatched" || status === "delivered") && <p className={styles.helper}>Orders already sent cannot be cancelled here.</p>}
      </div>
    </details>}

  </section>;
}

function DeliverySubmit({ editing }: { editing: boolean }) { const { pending } = useFormStatus(); return <button disabled={pending} className="button button-primary" type="submit">{editing ? "Save delivery details" : "Mark as dispatched"}</button>; }
function NoteSubmit() { const { pending } = useFormStatus(); return <button disabled={pending} className="button button-quiet" type="submit">Save private note</button>; }
