import Link from "next/link";
import { LegalBusinessDetails, LegalPage, LegalSection } from "@/components/legal-page";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Notice"
      intro="This notice explains what personal information HolyHub uses, why we use it and the choices and rights available to you."
    >
      <LegalSection title="1. Who is responsible for your information">
        <p>Alea Daniel trading as HolyHub is responsible for the personal information HolyHub collects and uses for operating the platform.</p>
        <LegalBusinessDetails />
      </LegalSection>

      <LegalSection title="2. Information we may collect">
        <p>This may include your name, email address, account information, communications, order and payment-related records, delivery details, lister application and storefront information, and technical or security information needed to operate and protect the service.</p>
        <p>HolyHub does not need your full card details. Card payment information is handled by the payment provider used at checkout.</p>
      </LegalSection>

      <LegalSection title="3. Why we use information">
        <p>We use personal information to create and secure accounts, operate the marketplace, process and support orders, communicate with users, review lister applications, prevent fraud and abuse, resolve issues, comply with legal and accounting obligations and improve the reliability of HolyHub.</p>
      </LegalSection>

      <LegalSection title="4. Our lawful bases">
        <p>Depending on the activity, we rely on performance of a contract or steps requested before entering a contract, compliance with legal obligations, our legitimate interests in operating and protecting HolyHub, and consent where the law requires it.</p>
      </LegalSection>

      <LegalSection title="5. Who we share information with">
        <p>We may share information with service providers that help us operate HolyHub, including authentication, database and payment providers. For marketplace orders, relevant delivery and order information may be shared with the lister who sold the product so they can fulfil the order, provide customer service and handle returns.</p>
        <p>We may also disclose information where required by law, to protect users or the platform, or in connection with professional advisers and legitimate legal claims.</p>
      </LegalSection>

      <LegalSection title="6. Listers and customer information">
        <p>Once an independent lister receives customer information for fulfilment or returns, that lister is also responsible for handling that information lawfully for its own activities.</p>
      </LegalSection>

      <LegalSection title="7. International processing">
        <p>Some technology providers may process information outside the UK. Where this occurs, HolyHub will rely on the provider&apos;s applicable transfer mechanism or other safeguards required by UK data protection law.</p>
      </LegalSection>

      <LegalSection title="8. How long we keep information">
        <p>We keep information only for as long as reasonably needed for the purpose it was collected, including account operation, orders, fraud prevention, disputes and legal, tax or accounting requirements. Different records may have different retention periods.</p>
      </LegalSection>

      <LegalSection title="9. Your rights">
        <p>Depending on the circumstances, you may have rights to access, correct or delete personal information, restrict or object to certain processing, and receive certain information in a portable format. Where processing is based on consent, you can withdraw that consent.</p>
        <p>To make a privacy request, email <a className="text-link" href="mailto:Official.holyhub@gmail.com">Official.holyhub@gmail.com</a>. You also have the right to complain to the UK Information Commissioner&apos;s Office.</p>
      </LegalSection>

      <LegalSection title="10. Cookies and device storage">
        <p>See our <Link className="text-link" href="/cookies">Cookie & Device Storage Notice</Link>.</p>
      </LegalSection>

      <LegalSection title="11. Changes">
        <p>We will update this notice when our data use materially changes and will provide appropriate notice where required.</p>
      </LegalSection>
    </LegalPage>
  );
}
