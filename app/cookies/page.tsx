import { LegalPage, LegalSection } from "@/components/legal-page";

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie & Device Storage Notice"
      intro="HolyHub currently uses essential storage needed for accounts, security and the shopping basket. We do not currently use advertising or analytics tracking."
    >
      <LegalSection title="1. What we use">
        <p>HolyHub uses authentication and session cookies through its account system so users can sign in securely and remain authenticated where appropriate.</p>
        <p>The basket uses browser local storage under the key <strong>holyhub-basket</strong> so items you add can remain in your basket on that device.</p>
      </LegalSection>

      <LegalSection title="2. Essential storage">
        <p>Storage that is strictly necessary to provide a service you request, such as keeping a secure login session or remembering items placed in an online basket, can be used without optional-cookie consent where the legal exemption applies. We still explain it here for transparency.</p>
      </LegalSection>

      <LegalSection title="3. Stripe checkout">
        <p>If you continue to Stripe&apos;s hosted checkout, Stripe may use cookies or similar technologies on its own service for payment, fraud prevention, security and related purposes. Stripe&apos;s own notices apply to its service.</p>
      </LegalSection>

      <LegalSection title="4. Analytics and advertising">
        <p>HolyHub does not currently use non-essential advertising or analytics cookies. If we add non-essential tracking later, we will update this notice and add an appropriate consent control before setting those technologies where consent is required.</p>
      </LegalSection>

      <LegalSection title="5. Your controls">
        <p>You can remove cookies and local storage through your browser settings. Clearing essential session storage may sign you out, and clearing HolyHub basket storage may remove items saved in your basket on that device.</p>
      </LegalSection>

      <LegalSection title="6. Questions">
        <p>Email <a className="text-link" href="mailto:Official.holyhub@gmail.com">Official.holyhub@gmail.com</a> with questions about HolyHub&apos;s use of cookies or device storage.</p>
      </LegalSection>
    </LegalPage>
  );
}
