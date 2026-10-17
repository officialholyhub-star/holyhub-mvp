import { LegalBusinessDetails, LegalPage, LegalSection } from "@/components/legal-page";

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact HolyHub"
      intro="For account, marketplace, order or lister support, contact HolyHub using the details below."
    >
      <LegalSection title="HolyHub contact details">
        <LegalBusinessDetails />
        <p><a className="button button-primary" href="mailto:official.holyhub@gmail.com">Email support</a></p>
      </LegalSection>

      <LegalSection title="Product returns">
        <p>Do not send product returns to the HolyHub business address unless we specifically tell you to. Products are sold by independent sellers and returns should normally go to the relevant seller&apos;s return address.</p>
      </LegalSection>

      <LegalSection title="What to include">
        <p>For an order, refund, return or delivery issue, include your order reference and the seller or product involved. For lister support, include your application, shop or listing details where relevant.</p>
        <p>Do not email card numbers, passwords or other unnecessary sensitive information.</p>
      </LegalSection>
    </LegalPage>
  );
}
