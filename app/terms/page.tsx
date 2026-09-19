import Link from "next/link";
import { LegalBusinessDetails, LegalPage, LegalSection } from "@/components/legal-page";

export default function TermsPage() {
  return (
    <LegalPage
      title="Customer Terms & Conditions"
      intro="These terms explain how HolyHub works, who you are buying from and the rules that apply when you use the marketplace."
    >
      <LegalSection title="1. Who operates HolyHub">
        <p>HolyHub is operated by Alea Daniel, a sole trader trading as HolyHub.</p>
      </LegalSection>

      <LegalSection title="2. HolyHub is a marketplace">
        <p>HolyHub provides an online marketplace where independent listers can offer products to customers. Unless a listing clearly says otherwise, the lister named on the product is the seller of that product and your contract for the goods is with that lister.</p>
        <p>HolyHub may provide the marketplace, process or facilitate payment, provide customer support and help with disputes. This does not make HolyHub the seller of a lister&apos;s goods.</p>
      </LegalSection>

      <LegalSection title="3. Accounts">
        <p>You must provide accurate information and keep your login details secure. If you are not legally able to enter into a contract yourself, you should only use HolyHub with the involvement of a parent, guardian or other responsible adult where required.</p>
      </LegalSection>

      <LegalSection title="4. Products, prices and orders">
        <p>Listers are responsible for making sure their descriptions, prices, images and product information are accurate. Prices are shown in pounds sterling. Any delivery charge that applies must be shown before you commit to payment.</p>
        <p>Placing an order is an offer to buy. An order may be declined or cancelled where a product is unavailable, information is clearly incorrect, payment is not authorised, fraud is suspected or the order cannot lawfully be fulfilled.</p>
      </LegalSection>

      <LegalSection title="5. Payment">
        <p>Payments are processed securely through HolyHub&apos;s payment provider. HolyHub may receive customer payment on behalf of the relevant lister and account to that lister after applicable HolyHub fees, refunds, chargebacks and reserves.</p>
      </LegalSection>

      <LegalSection title="6. Delivery">
        <p>HolyHub&apos;s launch marketplace is intended for UK delivery only. Each lister is responsible for dispatching their own products. Orders containing products from more than one lister may arrive in separate parcels and at different times.</p>
        <p>See our <Link className="text-link" href="/shipping">Shipping & Delivery Policy</Link>.</p>
      </LegalSection>

      <LegalSection title="7. Cancellations, returns and refunds">
        <p>Your legal rights are not reduced by these terms. For eligible online purchases, you may have a right to cancel after delivery. Separate rules and exceptions apply to some products, including personalised, perishable and certain sealed hygiene goods.</p>
        <p>Physical returns are normally sent to the lister who sold the product, using the return address or instructions they provide. Do not send product returns to HolyHub&apos;s business contact address unless HolyHub specifically tells you to do so.</p>
        <p>See our <Link className="text-link" href="/returns">Returns & Refunds Policy</Link>.</p>
      </LegalSection>

      <LegalSection title="8. Faulty or misdescribed products">
        <p>Products sold by listers must comply with applicable consumer law. Nothing in these terms removes rights you have where goods are faulty, not as described, unsafe or otherwise fail to meet legal requirements.</p>
      </LegalSection>

      <LegalSection title="9. Marketplace support and disputes">
        <p>You should first follow the order or return instructions for the relevant lister. If you cannot resolve a marketplace issue, you can contact HolyHub. HolyHub may review information from both sides and help facilitate a resolution, but this does not remove either party&apos;s legal rights.</p>
      </LegalSection>

      <LegalSection title="10. Acceptable use">
        <p>You must not misuse HolyHub, interfere with its security, attempt unauthorised access, use another person&apos;s account without permission, commit fraud or use HolyHub for unlawful activity.</p>
      </LegalSection>

      <LegalSection title="11. Intellectual property">
        <p>HolyHub&apos;s branding, website design and original platform content belong to HolyHub or its licensors. Product images, names and content supplied by listers remain the responsibility of the relevant rights holder.</p>
      </LegalSection>

      <LegalSection title="12. Liability and statutory rights">
        <p>Nothing in these terms excludes or limits liability where the law does not allow that, and nothing limits your statutory consumer rights. HolyHub is not responsible for losses caused solely by an independent lister&apos;s breach of its obligations, although HolyHub may provide marketplace support where appropriate.</p>
      </LegalSection>

      <LegalSection title="13. Changes">
        <p>HolyHub is still developing. We may update the platform or these terms. Where a change materially affects existing rights or paid services, we will take reasonable steps to give appropriate notice. The version applying to an order will be the version presented when that order is placed.</p>
      </LegalSection>

      <LegalSection title="14. Governing law">
        <p>These terms are governed by the laws of England and Wales. If you are a consumer, this does not remove any mandatory protections or court rights you have under the law that applies to you.</p>
      </LegalSection>

      <LegalSection title="15. Contact">
        <LegalBusinessDetails />
      </LegalSection>
    </LegalPage>
  );
}
