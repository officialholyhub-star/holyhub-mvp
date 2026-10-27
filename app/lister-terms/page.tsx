import { LegalBusinessDetails, LegalPage, LegalSection } from "@/components/legal-page";

export default function ListerTermsPage() {
  return (
    <LegalPage
      title="Lister Terms"
      intro="Pre-launch draft. These terms reflect HolyHub’s approved marketplace policy, but final professional legal review and binding versioned acceptance are still required before any lister is activated to sell."
    >
      <LegalSection title="1. Your relationship with HolyHub">
        <p>HolyHub operates the marketplace and facilitates the marketplace interaction and payment process. Unless HolyHub explicitly agrees otherwise in writing, you are the independent seller and trader supplying the products you list to the customer.</p>
        <p>The lister relationship is rolling and has no fixed minimum term. There is no exclusivity requirement and HolyHub does not charge a cancellation fee merely because you choose to stop selling through HolyHub.</p>
      </LegalSection>

      <LegalSection title="2. Seller identity and information">
        <p>You must provide complete and accurate information about yourself and your business and keep it up to date. Before customer sales are enabled, HolyHub may require and verify legal identity, establishment or service address, contact, tax, payout and other information reasonably required for payments, fraud prevention, customer information duties or legal compliance.</p>
        <p>You must provide a valid address for customer returns where returns are legally required. HolyHub&apos;s own business contact address is not your product returns address.</p>
      </LegalSection>

      <LegalSection title="3. Products and listings">
        <p>You are responsible for the products you supply, including accurate product information, genuine availability, lawful content, safety, quality, fulfilment and seller-side obligations to customers. You must own or have permission to use the names, images, trademarks and other content you upload.</p>
        <p>You must not list illegal, counterfeit, unsafe, infringing or misleading products, or products prohibited by applicable law, HolyHub&apos;s marketplace rules or relevant payment-provider requirements.</p>
        <p>HolyHub may review listings before publication and may pause or remove a listing where reasonably necessary for safety, fraud prevention, legal compliance, policy enforcement or marketplace trust.</p>
      </LegalSection>

      <LegalSection title="4. Listing fees, commission and processing charges">
        <p>HolyHub&apos;s launch commission is 5% of the product subtotal. Commission is not charged on the seller&apos;s delivery charge.</p>
        <p>Each lister has 10 permanent free listing slots. A distinct product uses a slot once it is submitted or published; an unfinished draft does not use a slot. Hiding or drafting an existing product does not free that slot for a different product. Each additional distinct listing beyond the 10 free slots costs £0.20 once. Editing the same product does not create another listing charge, and deleting and recreating substantially the same product to avoid a fee is not permitted.</p>
        <p>You also bear applicable payment-processing fees unless HolyHub itself caused the relevant problem and is responsible for that cost under these terms or applicable law. HolyHub will not introduce a new or increased marketplace fee retrospectively and will communicate material fee changes before they take effect.</p>
      </LegalSection>

      <LegalSection title="5. Dispatch, delivery and fulfilment">
        <p>You are responsible for packaging and sending your own orders to the delivery address supplied for fulfilment. HolyHub&apos;s MVP launch model is UK-only delivery. You may offer free delivery or the HolyHub-supported seller delivery charge shown to the customer.</p>
        <p>You must choose and follow a realistic HolyHub-approved dispatch timeframe. The timeframe shown before purchase is captured against the order and later changes to your shop settings do not rewrite an existing customer&apos;s order promise.</p>
        <p>You must promptly tell HolyHub when an order cannot be fulfilled and must cooperate with lawful cancellation, refund and customer-support processes.</p>
      </LegalSection>

      <LegalSection title="6. Customer payments and seller transfers">
        <p>A multi-seller basket uses one customer payment to HolyHub through Stripe Connect separate charges and transfers. HolyHub records each seller’s product value, delivery, commission and eligible proceeds separately.</p>
        <p>HolyHub may collect the customer&apos;s marketplace payment through its payment provider. For MVP, your eligible proceeds for a seller order portion are not transferred merely because the customer paid or because you dispatched the order.</p>
        <p>Your eligible proceeds are transferred only after your own seller order portion is confirmed delivered or completed under HolyHub&apos;s implemented order lifecycle. In a multi-seller basket, one seller&apos;s completed portion does not release another seller&apos;s proceeds.</p>
        <p>Amounts properly deductible from your seller proceeds may include the stated HolyHub commission, applicable processing charges and any verified same-seller debt or recovery expressly permitted by these terms. HolyHub must not use another seller&apos;s money to satisfy an amount you owe.</p>
      </LegalSection>

      <LegalSection title="7. Reserves and risk controls">
        <p>HolyHub does not apply a blanket 15% / 45-day reserve to every new lister. If a targeted reserve or stronger payout control is later required for a genuinely higher-risk seller, it must be based on defensible risk factors and communicated transparently, including the reason and expected release treatment.</p>
      </LegalSection>

      <LegalSection title="8. Returns, refunds and seller responsibility">
        <p>You must comply with applicable consumer cancellation, return, refund, quality and product-safety obligations. A lister cannot remove or veto a customer&apos;s statutory rights.</p>
        <p>Where evidence shows that you caused the problem—for example non-dispatch, seller cancellation, or wrong, faulty, damaged or materially not-as-described goods—you normally bear the appropriate verified seller-side financial consequence. Where HolyHub caused the problem, HolyHub bears the appropriate HolyHub-side cost. A chargeback or dispute does not automatically make you responsible; responsibility must be assessed from the relevant evidence.</p>
        <p>Refunds are limited to the affected seller’s items or delivery amount. Before transfer, the relevant held allocation is reduced. After transfer, HolyHub refunds the customer and seeks an appropriate reversal or recovery from that seller. Another seller’s allocation is never used to meet your responsibility.</p>
        <p>When product value is refunded, HolyHub credits back its 5% commission proportionally to the refunded product amount. A delivery-only refund does not create a HolyHub commission adjustment because commission is not charged on delivery. A customer refund that is legally or contractually due must not be reduced because of HolyHub fees, payment-processing fees or internal settlement costs.</p>
      </LegalSection>

      <LegalSection title="9. Seller-responsible refund shortfalls and reimbursement debt">
        <p>If a customer refund is properly due, you are responsible for the verified amount, and your available seller funds are insufficient at that moment, HolyHub may temporarily advance the seller-responsible shortfall so the customer refund is not delayed merely because of seller liquidity.</p>
        <p>Any verified seller-responsible amount that HolyHub advances on your behalf becomes a contractual reimbursement debt that you owe to HolyHub. Your obligation to reimburse that verified amount continues until fully resolved, including if you stop selling, close your HolyHub account or have no future HolyHub sales.</p>
        <p>HolyHub may recover a verified outstanding seller debt from amounts otherwise payable to that same seller where the implemented payment architecture supports that recovery, or through another lawful agreed repayment route. Recovery is repayment of an existing verified debt, not an additional fee. It must never exceed the verified balance, must not be applied twice and must never use another seller&apos;s money.</p>
        <p>If an amount remains unpaid, HolyHub may send clear repayment reminders and a final notice with a reasonable deadline. If the debt remains unresolved, HolyHub may suspend your ability to take new orders and may consider proportionate lawful recovery steps.</p>
      </LegalSection>

      <LegalSection title="10. Customer data">
        <p>You may use customer personal information received through HolyHub only for lawful purposes connected with the order, fulfilment, customer service, returns, fraud prevention or legal obligations. You must keep it secure and must not add customers to marketing lists without a valid lawful basis.</p>
      </LegalSection>

      <LegalSection title="11. Taxes and records">
        <p>You are responsible for your own tax, accounting, VAT and record-keeping obligations. HolyHub may collect, verify, retain or report seller information where required by applicable law or marketplace reporting obligations.</p>
      </LegalSection>

      <LegalSection title="12. Suspension, review and removal">
        <p>HolyHub may pause or remove listings or seller access where reasonably necessary for safety, suspected fraud, legal compliance, serious or repeated policy breaches, unresolved seller debt, payment risk or marketplace trust. Where appropriate, HolyHub should provide a fair route to review or appeal a decision.</p>
      </LegalSection>

      <LegalSection title="13. Ending your lister relationship">
        <p>You may stop listing and selling through HolyHub without an exclusivity restriction or cancellation fee. Ending your lister relationship does not remove responsibility for existing orders, returns, refunds, chargebacks, verified reimbursement debt, taxes, records or other obligations that arose before exit.</p>
      </LegalSection>

      <LegalSection title="14. Changes and acceptance evidence">
        <p>HolyHub dates and versions important marketplace terms. Where acceptance is required, HolyHub records which version you accepted. Material changes to fees, payout timing or core seller obligations will be communicated before they take effect, and fresh acceptance will be obtained where legally or contractually necessary.</p>
      </LegalSection>

      <LegalSection title="15. Governing law and contact">
        <p>These Lister Terms are intended to be governed by the laws of England and Wales, subject to final professional legal review before the binding launch version is activated.</p>
        <LegalBusinessDetails />
      </LegalSection>
    </LegalPage>
  );
}
