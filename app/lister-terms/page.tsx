import { LegalBusinessDetails, LegalPage, LegalSection } from "@/components/legal-page";

export default function ListerTermsPage() {
  return (
    <LegalPage
      title="Lister Terms"
      intro="These terms apply to businesses and creators approved to list and sell products through the HolyHub marketplace."
    >
      <LegalSection title="1. Your role as a lister">
        <p>When you list a product on HolyHub, you are the seller of that product to the customer unless HolyHub explicitly agrees otherwise in writing. You are responsible for your products, product information, fulfilment, customer rights and legal compliance.</p>
      </LegalSection>

      <LegalSection title="2. Eligibility and information">
        <p>You must provide complete and accurate information about yourself and your business and keep it up to date. Before live selling, HolyHub may require identity, business, tax, payout and address information where reasonably required for payments, fraud prevention or legal compliance.</p>
        <p>You must provide a valid address for customer returns where returns are legally required. HolyHub&apos;s own business address is not your returns address.</p>
      </LegalSection>

      <LegalSection title="3. Listings and products">
        <p>Listings must be accurate, lawful, safe, genuinely available and suitable for the HolyHub marketplace. You must own or have permission to use the names, images, trademarks and other content you upload.</p>
        <p>You must not list illegal, counterfeit, unsafe, infringing or misleading products, or products prohibited by HolyHub&apos;s payment providers or applicable law.</p>
      </LegalSection>

      <LegalSection title="4. Pricing and HolyHub fees">
        <p>During a pilot or testing period, HolyHub may waive marketplace fees. When the paid fee model is activated, the current structure is: the first 10 active product listings at a time are free; active listings above 10 cost £0.20 per listing; and HolyHub&apos;s sales commission is 5% of the product subtotal, excluding delivery charges.</p>
        <p>HolyHub will not apply a new or increased fee retrospectively. Material fee changes will be communicated before they take effect.</p>
      </LegalSection>

      <LegalSection title="5. Delivery and fulfilment">
        <p>You are responsible for dispatching orders to the customer address supplied for fulfilment. The launch model is UK-only delivery. You may offer free delivery or a flat delivery charge. Delivery is intended to be charged once per lister in an order, not once per product.</p>
        <p>You must provide realistic dispatch or delivery information, package goods appropriately and cooperate promptly where an order cannot be fulfilled.</p>
      </LegalSection>

      <LegalSection title="6. Payments, payouts and reserves">
        <p>HolyHub may collect customer payments through its payment provider and account to you after permitted deductions. Deductions may include HolyHub fees, refunds, chargebacks, reversals and reserves.</p>
        <p>For an untracked order, the current planned rule is that the main payout becomes eligible 21 days after dispatch and a retained reserve becomes eligible for release 30 days after dispatch. Additional or longer holds may be applied where reasonably necessary for disputes, chargebacks, fraud, payment-provider requirements or legal obligations.</p>
      </LegalSection>

      <LegalSection title="7. Returns and consumer rights">
        <p>You must comply with applicable consumer cancellation, return, refund, quality and product-safety obligations. Where a customer has a legal right to return goods, you must provide appropriate return instructions and a valid return address.</p>
        <p>HolyHub may facilitate refunds or marketplace disputes and may recover refunded, charged-back or otherwise owed amounts from money due to you or from an applicable reserve where lawful.</p>
      </LegalSection>

      <LegalSection title="8. Customer data">
        <p>You may use customer personal information received through HolyHub only for lawful purposes connected with the order, fulfilment, customer service, returns, fraud prevention or legal obligations. You must keep it secure and must not add customers to marketing lists without a valid lawful basis.</p>
      </LegalSection>

      <LegalSection title="9. Taxes and records">
        <p>You are responsible for your own tax, accounting, VAT and record-keeping obligations. HolyHub may collect, verify or report seller information if a future legal obligation requires it.</p>
      </LegalSection>

      <LegalSection title="10. Suspension or removal">
        <p>HolyHub may pause or remove listings or lister access where reasonably necessary for safety, legal compliance, suspected fraud, repeated customer issues, payment risk, serious breach of these terms or harm to the marketplace.</p>
      </LegalSection>

      <LegalSection title="11. Ending lister access">
        <p>You may stop listing products, but obligations connected with existing orders, refunds, disputes, chargebacks, taxes and records continue where applicable. HolyHub may retain amounts reasonably required to deal with unresolved liabilities.</p>
      </LegalSection>

      <LegalSection title="12. Changes">
        <p>HolyHub may update these terms as the marketplace develops. Material changes affecting fees, payouts or core lister obligations will be communicated before they take effect where reasonably possible.</p>
      </LegalSection>

      <LegalSection title="13. Governing law and contact">
        <p>These lister terms are governed by the laws of England and Wales.</p>
        <LegalBusinessDetails />
      </LegalSection>
    </LegalPage>
  );
}
