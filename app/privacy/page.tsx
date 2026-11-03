export const metadata = { title: "Your information" };
export default function PrivacyPage() {
  return <article className="content-narrow card prose">
    <p className="eyebrow">Your information</p><h1 className="page-title">Privacy, simply.</h1>
    <p>This notice describes information used by the HolyHub marketplace app. Questions or requests can be sent to <a className="text-link" href="mailto:Official.holyhub@gmail.com">Official.holyhub@gmail.com</a>.</p>
    <h2>Your account</h2><p>HolyHub uses Supabase to store your name, email address and account details, and to authenticate your password. Session cookies keep you logged in. Your account is not automatically added to a marketing mailing list.</p>
    <h2>Security checks</h2><p>When enabled, Cloudflare Turnstile checks signup, login and password-recovery forms for automated abuse. The verification token is passed to Supabase for validation. You can read more in <a className="text-link" href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare’s privacy policy (opens in a new tab)</a>.</p>
    <h2>Businesses and products</h2><p>Reviewers can see submitted business information and its review status. Approved business profiles and published product details and photos are public. Do not include private or sensitive information in these fields.</p>
    <h2>Public events</h2><p>Published event descriptions, organiser names, venues, schedules and organiser links are public. Only HolyHub administrators can edit this directory. Event booking takes place on the organiser’s website.</p>
    <h2>Baskets and orders</h2><p>The app stores your saved basket, order item details, amounts and delivery updates. You can see your orders; each seller can see their part of an order; authorised HolyHub administrators can review marketplace records. Payment acceptance is not enabled in this version, and HolyHub does not collect card numbers through these forms.</p>
    <h2>Refund requests and evidence</h2><p>Refund questionnaires, responses, photos, decisions and appeals are shared with the customer, relevant seller and authorised HolyHub reviewers. Uploaded evidence is stored privately and made available through short-lived links. Avoid including card numbers, bank details or unnecessary personal information.</p>
    <h2>Account updates and activity</h2><p>In-account notifications help you follow reviews, orders and refund cases. HolyHub records administrative and marketplace actions to investigate problems and protect the service. This app does not use advertising trackers.</p>
    <h2>Managing your information</h2><p>You can edit your account, business and product information where applicable. Contact HolyHub for access, correction, account closure or deletion requests. Closing account access is separate from deleting records; order and case history are not automatically erased by the account-close control.</p>
    <h2>Other websites</h2><p>Business and social links take you to other services, whose privacy practices apply when you visit them.</p>
  </article>;
}
