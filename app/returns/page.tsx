import { LegalPage, LegalSection } from "@/components/legal-page";

export default function ReturnsPage() {
  return (
    <LegalPage
      title="Returns & Refunds Policy"
      intro="The lister who sold the product is responsible for the goods. HolyHub can help support the marketplace process when needed."
    >
      <LegalSection title="1. Change-of-mind cancellations">
        <p>For most eligible goods bought online, a UK consumer can notify the seller that they want to cancel within 14 days after receiving the goods. They then normally have a further 14 days to return the goods.</p>
      </LegalSection>

      <LegalSection title="2. Where to return products">
        <p>Products must normally be returned to the lister who sold them, using the return address or instructions provided for that order. <strong>Do not send product returns to HolyHub&apos;s business contact address unless HolyHub specifically instructs you to do so.</strong></p>
      </LegalSection>

      <LegalSection title="3. Return postage">
        <p>For a change-of-mind return, the customer may be responsible for the direct cost of returning the product where this was made clear before purchase. Where goods are faulty, damaged, unsafe or not as described, different legal rights apply and the seller may be responsible for appropriate return costs.</p>
      </LegalSection>

      <LegalSection title="4. Refunds">
        <p>Where a valid cancellation right applies, the seller must provide the refund required by law, including the standard delivery amount where applicable. A refund may be held until the goods are returned or appropriate evidence of return is supplied where the law permits.</p>
      </LegalSection>

      <LegalSection title="5. Exceptions">
        <p>Some goods can be excluded from change-of-mind cancellation rights, including certain personalised or custom-made goods, perishable items and sealed goods that cannot be returned for health or hygiene reasons once unsealed. This does not remove rights relating to faulty or misdescribed goods.</p>
      </LegalSection>

      <LegalSection title="6. Faulty, damaged or misdescribed goods">
        <p>Customers retain their statutory rights. If a product is faulty, damaged, unsafe, not as described or otherwise fails to meet legal requirements, contact the lister or HolyHub support with the order details and relevant information.</p>
      </LegalSection>

      <LegalSection title="7. How to request help">
        <p>Until HolyHub&apos;s in-app refund workflow is launched, marketplace support can be requested by emailing <a className="text-link" href="mailto:Official.holyhub@gmail.com">Official.holyhub@gmail.com</a>. Include your order details and the lister or product involved.</p>
      </LegalSection>
    </LegalPage>
  );
}
