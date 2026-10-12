import Link from "next/link";
import type { FulfilmentSummary as Summary } from "@/lib/fulfilment-summary";
import styles from "./fulfilment-summary.module.css";
import { HelpIcon } from "./help-icon";
import { FULFILMENT_HELP } from "@/lib/help-copy";

export function FulfilmentSummary({ summary, compact = false }: { summary: Summary | null; compact?: boolean }) {
  return (
    <section className={`${styles.summary} ${compact ? styles.compact : ""}`} aria-label="Orders and fulfilment summary">
      <div className={styles.heading}>
        <h2>Orders / Fulfilment</h2>
        {!compact && <Link className="button button-quiet" href="/lister/orders">View orders</Link>}
      </div>
      {summary ? <>
        <dl className={styles.counts}>
          <div className={styles.primary}><dt>Orders to fulfil <HelpIcon label="Orders to fulfil" text={FULFILMENT_HELP.toFulfil} /></dt><dd>{summary.toFulfil}</dd></div>
          <div><dt>Processing <HelpIcon label="Processing" text={FULFILMENT_HELP.packed} /></dt><dd>{summary.processing}</dd></div>
          <div><dt>Dispatched <HelpIcon label="Dispatched" text={FULFILMENT_HELP.dispatched} /></dt><dd>{summary.dispatched}</dd></div>
          <div><dt>Completed <HelpIcon label="Completed" text={FULFILMENT_HELP.delivered} /></dt><dd>{summary.completed}</dd></div>
        </dl>
        {summary.completed === 0 && <p>Completed orders will appear here after delivery.</p>}
        {summary.toFulfil === 0 && <p className={styles.caughtUp}>No orders waiting to be prepared or sent.</p>}
      </> : <p role="status">Order counts could not be loaded. Please refresh to try again.</p>}
    </section>
  );
}
