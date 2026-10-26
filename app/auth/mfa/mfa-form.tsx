"use client";

import { useActionState } from "react";
import { enrollAdminTotp, verifyAdminTotp, type MfaResult } from "./actions";

export function MfaForm({ next, factors, setup = false }: {
  next: string; factors: { id: string; friendly_name?: string }[]; setup?: boolean;
}) {
  const [enrollment, enroll, enrolling] = useActionState<MfaResult, FormData>(enrollAdminTotp, {});
  const [verification, verify, verifying] = useActionState<MfaResult, FormData>(verifyAdminTotp, {});
  const factor = enrollment.enrollment;
  return <>
    {setup && !factor && <form action={enroll} className="form">
      <p>Add a new authenticator, then verify its code. Keep a backup on a separate secure device.</p>
      {enrollment.error && <p role="alert" className="notice notice-error">{enrollment.error}</p>}
      <button className="button button-primary" disabled={enrolling}>{enrolling ? "Starting setup…" : "Set up authenticator"}</button>
    </form>}
    {factor && <div className="form">
      <p>Scan this QR code with your authenticator app. Keep the QR code and setup key private.</p>
      {/* Supabase returns a data URL; no third-party QR service or image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={factor.qrCode} width={240} height={240} alt="Authenticator enrollment QR code" />
      <details><summary>Enter the setup key manually</summary><p><code>{factor.secret}</code></p></details>
    </div>}
    {(!setup || factor) && <form action={verify} className="form">
      <input type="hidden" name="next" value={next} />
      {factor ? <input type="hidden" name="factor_id" value={factor.factorId} /> : <div className="field">
        <label htmlFor="factor_id">Authenticator</label>
        <select id="factor_id" name="factor_id" required>{factors.map((item, index) =>
          <option key={item.id} value={item.id}>{item.friendly_name || `Authenticator ${index + 1}`}</option>
        )}</select>
      </div>}
      <div className="field">
        <label htmlFor="code">Authenticator code</label>
        <input id="code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
      </div>
      {verification.error && <p role="alert" className="notice notice-error">{verification.error}</p>}
      <button className="button button-primary" disabled={verifying}>{verifying ? "Verifying…" : "Verify and continue"}</button>
    </form>}
  </>;
}
