"use client";
import Link from "next/link";
import { useState } from "react";
import { HOLYHUB_LEGAL } from "@/lib/legal";
export function AccountDeletionRequest({ accountId }: { accountId: string }) {
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [opened, setOpened] = useState(false);
  return <form className="form" onSubmit={event => {
    event.preventDefault();
    if (confirmation !== "DELETE" || !acknowledged) return;
    window.location.href = `mailto:${HOLYHUB_LEGAL.email}?subject=${encodeURIComponent("HolyHub account deletion request")}&body=${encodeURIComponent(`Please permanently close my HolyHub account and delete personal account data where possible.\nAccount reference: ${accountId}\nI understand deletion cannot be undone and legitimately required records may be retained.\nIf I have a lister shop, unresolved orders, payouts, refunds and fulfilment obligations must be resolved before the shop closes.\nPlease verify my identity and arrange account closure.`)}`;
    setOpened(true);
  }}>
    <h2>Are you sure?</h2><p>This cannot be undone once your account has been deleted.</p>
    <p className="notice notice-info">Account deletion is currently arranged by email. The Delete account button opens a deletion request in your email app. You must send the email; this page does not delete your account immediately. We will verify your identity and arrange closure. Your account remains active until deletion is completed.</p>
    <label htmlFor="delete-confirmation">Type DELETE to confirm</label><input id="delete-confirmation" value={confirmation} onChange={event => setConfirmation(event.currentTarget.value)} pattern="DELETE" required autoComplete="off" />
    <label><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.currentTarget.checked)} required /> I understand deletion is permanent and HolyHub may retain records where legitimately required.</label>
    <div className="row-actions"><Link className="button button-quiet" href="/account">Cancel</Link><button className="button button-secondary" type="submit" disabled={confirmation !== "DELETE" || !acknowledged}>Delete account</button></div>
    {opened && <p role="status">Your account has not been deleted. Send the email in your email app to submit your deletion request. If it did not open, email {HOLYHUB_LEGAL.email} from your account email address with the subject “Account deletion request”. Account reference: {accountId}. No request has been stored by this page.</p>}
  </form>;
}
