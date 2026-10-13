"use client";

import { useId, useState, type ReactNode } from "react";
import { FULFILMENT_HELP } from "@/lib/help-copy";
import { HelpIcon } from "./help-icon";
import styles from "./order-export-tools.module.css";

export function OrderExportTools({ children, disabled = false }: { children?: ReactNode; disabled?: boolean }) {
  const id = useId();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function download(url: string) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok || response.redirected || !response.headers.get("content-type")?.includes("text/csv")) {
        setError(response.status === 400 ? "Select at least one order, then try exporting again." : response.redirected ? "Please log in again, then return to Orders to export." : "We couldn’t export complete order details. Refresh and try again; contact HolyHub if this continues.");
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = objectUrl; link.download = "holyhub-orders.csv"; link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch { setError("We couldn’t download your orders. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  return <div data-selecting={selecting}>
  {!disabled && <div className={styles.tools}>
    {error && <p role="alert" className="notice notice-error">{error} <a href="/auth/login?next=%2Flister%2Forders">Log in</a> · <a href="/contact">Contact HolyHub</a></p>}
    {busy && <p role="status">Preparing export…</p>}
    <div className={styles.heading}>
      <button className={styles.toggle} type="button" aria-pressed={selecting} onClick={() => setSelecting(!selecting)}>{selecting ? "Done selecting" : "Select orders"}</button>
      <button className={styles.toggle} type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>Export <span aria-hidden="true">{open ? "▴" : "▾"}</span></button>
      <HelpIcon label="Export" text={FULFILMENT_HELP.export} />
    </div>
    <div className={styles.content} id={id} hidden={!open}>
      <div className="order-export-actions">
        <a className="button button-quiet" href="/lister/orders/export?scope=unfulfilled" onClick={event => { event.preventDefault(); void download(event.currentTarget.href); }}>Export unfulfilled</a>
        <form id="selected-order-export" method="get" action="/lister/orders/export" onSubmit={event => { event.preventDefault(); const params = new URLSearchParams(); new FormData(event.currentTarget).forEach((value, key) => { if (typeof value === "string") params.append(key, value); }); void download(`/lister/orders/export?${params}`); }}><input type="hidden" name="scope" value="selected" /><button className="button button-quiet" type="submit" disabled={busy}>Export selected</button></form>
      </div>
      <p className="muted-small">Export unfulfilled includes Needs preparing, Processing and Dispatched. Export selected includes only the orders you’ve ticked.</p>
    </div>
  </div>}
  {children}
  </div>;
}
