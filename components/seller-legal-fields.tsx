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
    </div>
    <div className="field">
      <label htmlFor="entity_type">Legal structure</label>
      <select id="entity_type" name="entity_type" defaultValue={profile?.entity_type ?? ""} required>
        <option value="" disabled>Choose one</option>
        <option value="sole_trader">Sole trader</option>
        <option value="limited_company">Limited company</option>
        <option value="partnership">Partnership</option>
        <option value="charity_nonprofit">Charity / non-profit</option>
        <option value="other">Other organisation</option>
      </select>
    </div>
    <div className="field">
      <label htmlFor="address_line1">Business / establishment address</label>
      <input id="address_line1" name="address_line1" defaultValue={profile?.address_line1 ?? ""} maxLength={200} autoComplete="address-line1" required />
    </div>
    <div className="field">
      <label htmlFor="address_line2">Address line 2 <span className="muted-small">(optional)</span></label>
      <input id="address_line2" name="address_line2" defaultValue={profile?.address_line2 ?? ""} maxLength={200} autoComplete="address-line2" />
    </div>
    <div className="field">
      <label htmlFor="city">Town / city</label>
      <input id="city" name="city" defaultValue={profile?.city ?? ""} maxLength={120} autoComplete="address-level2" required />
    </div>
    <div className="field">
      <label htmlFor="postcode">Postcode</label>
      <input id="postcode" name="postcode" defaultValue={profile?.postcode ?? ""} maxLength={30} autoComplete="postal-code" required />
    </div>
    <div className="field">
      <label htmlFor="country">Country</label>
      <input id="country" name="country" defaultValue={profile?.country ?? "United Kingdom"} maxLength={100} autoComplete="country-name" required />
    </div>
    <div className="field">
      <label htmlFor="contact_email">Business contact email</label>
      <input id="contact_email" name="contact_email" type="email" defaultValue={profile?.contact_email ?? defaultEmail} maxLength={254} autoComplete="email" required />
    </div>
    <div className="field">
      <label htmlFor="contact_phone">Business phone <span className="muted-small">(if available)</span></label>
      <input id="contact_phone" name="contact_phone" type="tel" defaultValue={profile?.contact_phone ?? ""} maxLength={50} autoComplete="tel" />
    </div>
    <div className="field">
      <label htmlFor="registration_number">Company / organisation registration number <span className="muted-small">(where applicable)</span></label>
      <input id="registration_number" name="registration_number" defaultValue={profile?.registration_number ?? ""} maxLength={100} />
      <p className="muted-small">Required for a limited company.</p>
    </div>
    <div className="field">
      <label htmlFor="vat_number">VAT number <span className="muted-small">(if registered)</span></label>
      <input id="vat_number" name="vat_number" defaultValue={profile?.vat_number ?? ""} maxLength={100} />
    </div>
  </fieldset>;
}
