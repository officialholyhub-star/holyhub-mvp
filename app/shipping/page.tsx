import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";

export default function ShippingPage() {
  return (
    <LegalPage
      title="Shipping & Delivery Policy"
      intro="HolyHub is a marketplace. Independent listers fulfil and dispatch the products they sell."
    >
      <LegalSection title="1. Where we deliver">
        <p>HolyHub&apos;s launch marketplace is for delivery to UK addresses only.</p>
      </LegalSection>

      <LegalSection title="2. Who sends your order">
        <p>The individual lister shown on the product is responsible for packing and dispatching that product. If your basket contains products from different listers, you should expect separate parcels.</p>
      </LegalSection>

      <LegalSection title="3. Delivery charges">
        <p>Each lister may offer free delivery or set a flat delivery charge. HolyHub&apos;s launch model is designed so a delivery charge is applied once per lister in an order rather than once for every product from that lister.</p>
        <p>The applicable delivery charge must be shown before payment is completed.</p>
      </LegalSection>

      <LegalSection title="4. Delivery times">
        <p>Listers should provide realistic dispatch and delivery information. Unless a different timeframe is agreed with you, goods should be delivered within the period required by applicable UK distance-selling rules.</p>
      </LegalSection>

      <LegalSection title="5. Delivery problems">
        <p>If an order is late, missing or damaged in transit, contact the lister or HolyHub support promptly. If you entered the wrong delivery address, contact support as soon as possible, although changes cannot be guaranteed once an order has been dispatched.</p>
      </LegalSection>

      <LegalSection title="6. Returns">
        <p>Returns go to the relevant lister, not to HolyHub&apos;s business contact address. See the <Link className="text-link" href="/returns">Returns & Refunds Policy</Link>.</p>
      </LegalSection>
    </LegalPage>
  );
}
