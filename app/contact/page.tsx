import { LegalBusinessDetails, LegalPage, LegalSection } from "@/components/legal-page";

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact HolyHub"
      intro="For account, marketplace, order or lister support, contact HolyHub using the details below."
    >
      <LegalSection title="HolyHub contact details">
        <LegalBusinessDetails />
      </LegalSection>

      <LegalSection title="Product returns">
        <p>Do not send product returns to the HolyHub business address unless we specifically tell you to. Products are sold by independent listers and returns should normally go to the relevant lister&apos;s return address.</p>
      </LegalSection>

      <LegalSection title="What to include">
        <p>If your message is about an order, include your order reference, the product and the lister name where possible. Do not email card numbers, passwords or other unnecessary sensitive information.</p>
      </LegalSection>
    </LegalPage>
  );
}
