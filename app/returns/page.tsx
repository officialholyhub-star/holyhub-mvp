import { LegalPage, LegalSection } from "@/components/legal-page";

export default function ReturnsPage() {
  return (
    <LegalPage
      title="Returns & Refunds Policy"
      intro="The seller who sold the product is responsible for the goods. HolyHub can help support the marketplace process when needed."
    >
      <LegalSection title="1. Change-of-mind cancellations">
        <p>For most eligible goods bought online, a UK consumer can tell the seller that they want to cancel up to 14 days after the day the goods come into their physical possession. Where one order is delivered in separate deliveries, the cancellation period may run from receipt of the last goods, lot or piece as the law provides.</p>
      </LegalSection>

      <LegalSection title="2. Returning cancelled goods">
        <p>Unless the seller has offered to collect the goods, the customer must send or hand them back without undue delay and no later than 14 days after telling the seller that they are cancelling. Products must normally be returned to the seller who sold them, using the return address or instructions provided for that order. <strong>Do not send product returns to HolyHub&apos;s business contact address unless HolyHub specifically instructs you to do so.</strong></p>
      </LegalSection>

      <LegalSection title="3. Return postage">
        <p>For a change-of-mind return, the customer must normally bear the direct cost of returning the goods where the seller gave the required information about that cost before the contract. The seller may instead agree to bear the cost. Where goods are faulty, damaged, unsafe or not as described, different legal rights apply and the seller may be responsible for appropriate return costs.</p>
      </LegalSection>

      <LegalSection title="4. Refunds after a valid cancellation">
        <p>For a multi-seller order, a partial refund covers the affected items, seller portion or delivery amount. HolyHub’s internal commission credit, seller transfer reversal or same-seller recovery must not reduce a customer refund properly due. Seller liquidity must not delay a properly due refund. Faulty or damaged returns are not automatically restored to sellable stock.</p>
        <p>The seller must reimburse the payments required by law without undue delay. This includes the cost of the least expensive common and generally acceptable delivery option offered by the seller; any extra amount paid for a more expensive delivery option does not have to be reimbursed.</p>
        <p>Where the seller has not offered to collect the goods, the refund must be made no later than 14 days after the seller receives the goods back or, if earlier, after the customer supplies evidence that the goods were sent back. In other cases, the refund must be made no later than 14 days after the seller is informed of the cancellation. The refund must use the same payment method unless the customer expressly agrees otherwise, and no refund fee may be imposed.</p>
        <p>The seller may be able to deduct an amount for diminished value caused by handling beyond what is necessary to establish the nature, characteristics and functioning of the goods, where the law allows.</p>
      </LegalSection>

      <LegalSection title="5. Exceptions">
        <p>Some goods can be excluded from change-of-mind cancellation rights, including goods made to the customer&apos;s specifications or clearly personalised, goods liable to deteriorate or expire rapidly, and sealed goods that are not suitable for return for health protection or hygiene reasons once unsealed. This does not remove rights relating to faulty or misdescribed goods.</p>
      </LegalSection>

      <LegalSection title="6. Faulty, damaged or misdescribed goods">
        <p>Customers retain their statutory rights. If a product is faulty, damaged, unsafe, not as described or otherwise fails to meet legal requirements, contact the seller or HolyHub support with the order details and relevant information.</p>
      </LegalSection>

      <LegalSection title="7. Model cancellation form">
        <p>You may use the form below to tell the seller that you are cancelling an eligible contract, but using the form is not obligatory. You can instead make any other clear statement that you want to cancel.</p>
        <p><strong>To:</strong> [Seller name and geographical address provided for your order]</p>
        <p>I/We [*] hereby give notice that I/We [*] cancel my/our [*] contract of sale of the following goods [*]:</p>
        <p>[Goods]</p>
        <p>Ordered on [*] / received on [*]:</p>
        <p>Name of consumer(s):</p>
        <p>Address of consumer(s):</p>
        <p>Signature of consumer(s) (only if this form is notified on paper):</p>
        <p>Date:</p>
        <p>[*] Delete as appropriate.</p>
      </LegalSection>

      <LegalSection title="8. How to request help">
        <p>Marketplace cancellations and refunds are reviewed and processed through HolyHub support. You can request support by emailing <a className="text-link" href="mailto:official.holyhub@gmail.com">official.holyhub@gmail.com</a>. Include your order details and the seller or product involved.</p>
      </LegalSection>
    </LegalPage>
  );
}
