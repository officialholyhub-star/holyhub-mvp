import type { SellerLegalProfile } from "@/lib/seller-legal";

type SellerLegalFieldsProps = {
  profile?: SellerLegalProfile | null;
  defaultEmail?: string;
};

export function SellerLegalFields({ profile, defaultEmail = "" }: SellerLegalFieldsProps) {
  return <fieldset>
    <legend>Seller legal details</legend>
    <p className="muted-small">HolyHub reviews these details before a seller can trade. Required seller identity and contact details may be shown to customers where legally required.</p>
    <div className="field">
      <label htmlFor="legal_name">Legal name</label>
      <input id="legal_name" name="legal_name" defaultValue={profile?.legal_name ?? ""} maxLength={200} autoComplete="organization" required />
      <p className="muted-small">For a sole trader, use your own legal name. For a registered company or LLP, use the full registered name.</p>
    </div>
    <div className="field">
      <label htmlFor="entity_type">Legal structure</label>
      <select id="entity_type" name="entity_type" defaultValue={profile?.entity_type ?? ""} required>
        <option value="" disabled>Choose one</option>
        <option value="sole_trader">Sole trader</option>
        <option value="limited_company">Limited company</option>
        <option value="llp">Limited liability partnership (LLP)</option>
        <option value="partnership">Partnership</option>
        <option value="charity_nonprofit">Charity / non-profit</option>
        <option value="other">Other organisation</option>
      </select>
    </div>
    <div className="field"><label htmlFor="address_line1">Business / establishment address</label><input id="address_line1" name="address_line1" defaultValue={profile?.address_line1 ?? ""} maxLength={200} autoComplete="address-line1" required /><p className="muted-small">Use the geographical address where the seller is established and can be contacted about the sale.</p></div>
    <div className="field"><label htmlFor="address_line2">Address line 2 <span className="muted-small">(optional)</span></label><input id="address_line2" name="address_line2" defaultValue={profile?.address_line2 ?? ""} maxLength={200} autoComplete="address-line2" /></div>
    <div className="field"><label htmlFor="city">Town / city</label><input id="city" name="city" defaultValue={profile?.city ?? ""} maxLength={120} autoComplete="address-level2" required /></div>
    <div className="field"><label htmlFor="postcode">Postcode</label><input id="postcode" name="postcode" defaultValue={profile?.postcode ?? ""} maxLength={30} autoComplete="postal-code" required /></div>
    <div className="field"><label htmlFor="country">Country</label><input id="country" name="country" defaultValue={profile?.country ?? "United Kingdom"} maxLength={100} autoComplete="country-name" required /></div>
    <fieldset>
      <legend>Service address <span className="muted-small">(only if different)</span></legend>
      <p className="muted-small">Leave all of these blank if legal documents can be served at the business address above.</p>
      <div className="field"><label htmlFor="service_address_line1">Service address</label><input id="service_address_line1" name="service_address_line1" defaultValue={profile?.service_address_line1 ?? ""} maxLength={200} /></div>
      <div className="field"><label htmlFor="service_address_line2">Service address line 2 <span className="muted-small">(optional)</span></label><input id="service_address_line2" name="service_address_line2" defaultValue={profile?.service_address_line2 ?? ""} maxLength={200} /></div>
      <div className="field"><label htmlFor="service_address_city">Service address town / city</label><input id="service_address_city" name="service_address_city" defaultValue={profile?.service_address_city ?? ""} maxLength={120} /></div>
      <div className="field"><label htmlFor="service_address_postcode">Service address postcode</label><input id="service_address_postcode" name="service_address_postcode" defaultValue={profile?.service_address_postcode ?? ""} maxLength={30} /></div>
      <div className="field"><label htmlFor="service_address_country">Service address country</label><input id="service_address_country" name="service_address_country" defaultValue={profile?.service_address_country ?? ""} maxLength={100} /></div>
    </fieldset>
    <div className="field"><label htmlFor="contact_email">Business contact email</label><input id="contact_email" name="contact_email" type="email" defaultValue={profile?.contact_email ?? defaultEmail} maxLength={254} autoComplete="email" required /></div>
    <div className="field"><label htmlFor="contact_phone">Business phone <span className="muted-small">(if available)</span></label><input id="contact_phone" name="contact_phone" type="tel" defaultValue={profile?.contact_phone ?? ""} maxLength={50} autoComplete="tel" /></div>
    <div className="field"><label htmlFor="registration_number">Company / LLP / organisation registration number <span className="muted-small">(where applicable)</span></label><input id="registration_number" name="registration_number" defaultValue={profile?.registration_number ?? ""} maxLength={100} /><p className="muted-small">Required for a limited company or LLP.</p></div>
    <div className="field"><label htmlFor="registration_jurisdiction">Where registered <span className="muted-small">(company / LLP)</span></label><input id="registration_jurisdiction" name="registration_jurisdiction" defaultValue={profile?.registration_jurisdiction ?? ""} maxLength={100} placeholder="e.g. England and Wales" /></div>
    <fieldset>
      <legend>Registered office <span className="muted-small">(company / LLP)</span></legend>
      <p className="muted-small">Complete this if the seller is a limited company or LLP, even if it is the same as the business address above.</p>
      <div className="field"><label htmlFor="registered_office_line1">Registered office address</label><input id="registered_office_line1" name="registered_office_line1" defaultValue={profile?.registered_office_line1 ?? ""} maxLength={200} /></div>
      <div className="field"><label htmlFor="registered_office_line2">Registered office line 2 <span className="muted-small">(optional)</span></label><input id="registered_office_line2" name="registered_office_line2" defaultValue={profile?.registered_office_line2 ?? ""} maxLength={200} /></div>
      <div className="field"><label htmlFor="registered_office_city">Registered office town / city</label><input id="registered_office_city" name="registered_office_city" defaultValue={profile?.registered_office_city ?? ""} maxLength={120} /></div>
      <div className="field"><label htmlFor="registered_office_postcode">Registered office postcode</label><input id="registered_office_postcode" name="registered_office_postcode" defaultValue={profile?.registered_office_postcode ?? ""} maxLength={30} /></div>
      <div className="field"><label htmlFor="registered_office_country">Registered office country</label><input id="registered_office_country" name="registered_office_country" defaultValue={profile?.registered_office_country ?? ""} maxLength={100} /></div>
    </fieldset>
    <div className="field"><label htmlFor="vat_number">VAT number <span className="muted-small">(if registered)</span></label><input id="vat_number" name="vat_number" defaultValue={profile?.vat_number ?? ""} maxLength={100} /></div>
  </fieldset>;
}
