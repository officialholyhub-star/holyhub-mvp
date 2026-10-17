"use client";

import { createClient } from "@/lib/supabase/client";
import { formatRegisteredOffice, formatSellerAddress, formatServiceAddress, sellerEntityLabel, type SellerLegalInput } from "@/lib/seller-legal";
import { useEffect, useState } from "react";

type PublicSellerIdentity = SellerLegalInput & { user_id: string };

type BasketSellerDetailsProps = {
  sellerId: string;
  onStatusChange: (sellerId: string, ready: boolean) => void;
};

export function BasketSellerDetails({ sellerId, onStatusChange }: BasketSellerDetailsProps) {
  const [seller, setSeller] = useState<PublicSellerIdentity | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    onStatusChange(sellerId, false);
    void Promise.resolve(createClient().rpc("get_public_seller_identities", { p_user_ids: [sellerId] }))
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.[0]) {
          setFailed(true);
          onStatusChange(sellerId, false);
          return;
        }
        setFailed(false);
        setSeller(data[0] as PublicSellerIdentity);
        onStatusChange(sellerId, true);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          onStatusChange(sellerId, false);
        }
      });
    return () => { cancelled = true; };
  }, [sellerId, onStatusChange]);

  if (failed) return <p className="notice notice-error" role="alert">Seller details could not be verified. Checkout will stay unavailable until they can be confirmed.</p>;
  if (!seller) return <p className="muted-small">Checking seller details…</p>;
  const serviceAddress = formatServiceAddress(seller);
  const registeredOffice = formatRegisteredOffice(seller);

  return <details>
    <summary>Seller legal details</summary>
    <dl className="review-details">
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
