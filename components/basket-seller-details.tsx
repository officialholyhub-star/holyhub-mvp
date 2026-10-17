"use client";

import { createClient } from "@/lib/supabase/client";
import { dispatchTerms } from "@/lib/dispatch-timeframe";
import { formatRegisteredOffice, formatSellerAddress, formatServiceAddress, sellerEntityLabel, type SellerLegalInput } from "@/lib/seller-legal";
import { useEffect, useState } from "react";

type PublicSellerIdentity = SellerLegalInput & { user_id: string };
type DispatchSnapshot = { dispatch_window: string | null; dispatch_custom_timeframe: string | null };

type BasketSellerDetailsProps = {
  sellerId: string;
  onStatusChange: (sellerId: string, ready: boolean) => void;
};

export function BasketSellerDetails({ sellerId, onStatusChange }: BasketSellerDetailsProps) {
  const [seller, setSeller] = useState<PublicSellerIdentity | null>(null);
  const [dispatch, setDispatch] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    onStatusChange(sellerId, false);
    const supabase = createClient();
    void Promise.all([
      Promise.resolve(supabase.rpc("get_public_seller_identities", { p_user_ids: [sellerId] })),
      Promise.resolve(supabase.from("lister_storefronts").select("dispatch_window, dispatch_custom_timeframe").eq("user_id", sellerId).maybeSingle()),
    ]).then(([identityResult, dispatchResult]) => {
      if (cancelled) return;
      const identity = identityResult.data?.[0] as PublicSellerIdentity | undefined;
      const dispatchRow = dispatchResult.data as DispatchSnapshot | null;
      const terms = dispatchTerms(dispatchRow?.dispatch_window, dispatchRow?.dispatch_custom_timeframe);
      if (identityResult.error || dispatchResult.error || !identity || !terms) {
        setFailed(true);
        onStatusChange(sellerId, false);
        return;
      }
      setFailed(false);
      setSeller(identity);
      setDispatch(terms);
      onStatusChange(sellerId, true);
    }).catch(() => {
      if (!cancelled) {
        setFailed(true);
        onStatusChange(sellerId, false);
      }
    });
    return () => { cancelled = true; };
  }, [sellerId, onStatusChange]);

  if (failed) return <p className="notice notice-error" role="alert">Seller or dispatch details could not be verified. Checkout will stay unavailable until they can be confirmed.</p>;
  if (!seller || !dispatch) return <p className="muted-small">Checking seller and dispatch details…</p>;
  const serviceAddress = formatServiceAddress(seller);
  const registeredOffice = formatRegisteredOffice(seller);

  return <details>
    <summary>Seller & dispatch details</summary>
    <dl className="review-details">
      <div><dt>Dispatch</dt><dd>{dispatch}</dd></div>
      <div><dt>Legal seller</dt><dd>{seller.legal_name}</dd></div>
      <div><dt>Legal structure</dt><dd>{sellerEntityLabel(seller.entity_type)}</dd></div>
      <div><dt>Business address</dt><dd>{formatSellerAddress(seller)}</dd></div>
      {serviceAddress && <div><dt>Service address</dt><dd>{serviceAddress}</dd></div>}
      <div><dt>Email</dt><dd><a href={`mailto:${seller.contact_email}`}>{seller.contact_email}</a></dd></div>
      {seller.contact_phone && <div><dt>Phone</dt><dd><a href={`tel:${seller.contact_phone}`}>{seller.contact_phone}</a></dd></div>}
      {seller.registration_number && <div><dt>Registration number</dt><dd>{seller.registration_number}</dd></div>}
      {seller.registration_jurisdiction && <div><dt>Registered in</dt><dd>{seller.registration_jurisdiction}</dd></div>}
      {registeredOffice && <div><dt>Registered office</dt><dd>{registeredOffice}</dd></div>}
      {seller.vat_number && <div><dt>VAT number</dt><dd>{seller.vat_number}</dd></div>}
    </dl>
  </details>;
}
