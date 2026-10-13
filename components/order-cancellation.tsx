"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { CANCELLATION_REASONS, validCancellationReason } from "@/lib/order-cancellation";
import styles from "./order-update-panel.module.css";

export function OrderCancellation({ action, disabled }: { action: (data: FormData) => Promise<void>; disabled: boolean }) {
  const id = useId();
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const previousStep = useRef(0);
  useEffect(() => {
    if (step > 0) heading.current?.focus();
    else if (previousStep.current > 0) opener.current?.focus();
    previousStep.current = step;
  }, [step]);
  function keepOrder() { setStep(0); setReason(""); setCustomReason(""); setError(""); }

  return <div>
    {step === 0 && <button ref={opener} type="button" disabled={disabled} className="button button-quiet" aria-expanded={step > 0} aria-controls={`${id}-panel`} onClick={() => setStep(1)}>Cancel order</button>}
    {step > 0 && <section id={`${id}-panel`} className={step === 3 ? styles.cancelWarning : styles.correction} aria-labelledby={`${id}-heading`}>
      <h4 ref={heading} id={`${id}-heading`} tabIndex={-1}>{step === 1 ? "Reason for cancellation" : step === 2 ? "Cancel this order?" : "Are you absolutely sure?"}</h4>
      {step === 1 && <form className={styles.form} onSubmit={event => {
        event.preventDefault();
        if (!validCancellationReason(reason, customReason)) { setError("Choose a reason and enter a short explanation for Other."); return; }
        setError(""); setStep(2);
      }}>
        <div className={styles.field}><label htmlFor={`${id}-reason`}>Cancellation reason</label><select id={`${id}-reason`} required value={reason} onChange={event => setReason(event.target.value)}><option value="">Choose a reason</option>{Object.entries(CANCELLATION_REASONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        {reason === "other" && <div className={styles.field}><label htmlFor={`${id}-custom`}>Short reason</label><textarea id={`${id}-custom`} required maxLength={240} rows={2} value={customReason} onChange={event => setCustomReason(event.target.value)} /></div>}
        {error && <p role="alert">{error}</p>}
        <div className={styles.cancelActions}><button type="button" className="button button-quiet" onClick={keepOrder}>Keep order</button><button type="submit" className="button button-quiet">Review cancellation</button></div>
      </form>}
      {step === 2 && <><p>This will stop the normal order process and the customer will see that the order has been cancelled.</p><p><strong>Reason:</strong> {CANCELLATION_REASONS[reason as keyof typeof CANCELLATION_REASONS]}{reason === "other" ? ` — ${customReason.trim()}` : ""}</p><div className={styles.cancelActions}><button type="button" className="button button-quiet" onClick={keepOrder}>Keep order</button><button type="button" className="button button-quiet" onClick={() => setStep(3)}>Continue to cancellation</button></div></>}
      {step === 3 && <><p>This action should only be used when the order genuinely needs to be cancelled.</p><p><strong>Once cancelled, you will not be able to restore the order yourself.</strong></p><form action={async () => {
        const data = new FormData(); data.set("cancellation_reason", reason); data.set("cancellation_custom_reason", reason === "other" ? customReason.trim() : ""); data.set("cancellation_confirmation", "final"); await action(data);
      }}><div className={styles.cancelActions}><button type="button" className="button button-quiet" onClick={() => setStep(2)}>Go back</button><FinalCancel disabled={disabled} /></div></form></>}
    </section>}
  </div>;
}

function FinalCancel({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={disabled || pending} className={`button ${styles.cancelButton}`}>{pending ? "Cancelling…" : "Cancel order"}</button>;
}
