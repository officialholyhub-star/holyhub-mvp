import { LegalBusinessDetails, LegalPage, LegalSection } from "@/components/legal-page";

export default function ContactPage() {
  return (
    <LegalPage
      title="How can we help?"
      intro="We’re happy to help with general HolyHub questions and marketplace support."
    >
      <LegalSection title="Marketplace orders">
        <p>For help with an order, refund, return, delivery issue or marketplace purchase, include your order number and the seller or product involved.</p>
      </LegalSection>

      <LegalSection title="Lister support">
        <p>Selling on HolyHub? Include your application, shop or listing details so we can help faster.</p>
      </LegalSection>

      <LegalSection title="General support">
        <p>For general HolyHub questions, feedback or account support, contact our team.</p>
        <p><a className="button button-primary" href="mailto:official.holyhub@gmail.com">Email support</a></p>
        <p><a className="text-link" href="mailto:official.holyhub@gmail.com">official.holyhub@gmail.com</a></p>
      </LegalSection>

      <LegalSection title="HolyHub contact details">
        <LegalBusinessDetails />
      </LegalSection>

      <LegalSection title="Product returns">
        <p>Do not send product returns to the HolyHub business address unless we specifically tell you to. Products are sold by independent sellers and returns should normally go to the relevant seller&apos;s return address.</p>
      </LegalSection>
    </LegalPage>
  );
}
