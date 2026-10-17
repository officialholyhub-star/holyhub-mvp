export const SELLER_ENTITY_TYPES = [
  "sole_trader",
  "limited_company",
  "llp",
  "partnership",
  "charity_nonprofit",
  "other",
] as const;

export type SellerEntityType = (typeof SELLER_ENTITY_TYPES)[number];

export type SellerLegalInput = {
  legal_name: string;
  entity_type: SellerEntityType;
  address_line1: string;
  address_line2: string | null;
  city: string;
  postcode: string;
  country: string;
  service_address_line1: string | null;
  service_address_line2: string | null;
  service_address_city: string | null;
  service_address_postcode: string | null;
  service_address_country: string | null;
  contact_email: string;
  contact_phone: string | null;
  registration_number: string | null;
  registration_jurisdiction: string | null;
  registered_office_line1: string | null;
  registered_office_line2: string | null;
  registered_office_city: string | null;
  registered_office_postcode: string | null;
  registered_office_country: string | null;
  vat_number: string | null;
};

export type SellerLegalProfile = SellerLegalInput & {
  user_id: string;
  verification_status: "pending" | "verified" | "rejected";
  verification_note: string | null;
  verified_at: string | null;
  verified_by: string | null;
  created_at: string;
  updated_at: string;
};

export const SELLER_LEGAL_FIELDS = "user_id, legal_name, entity_type, address_line1, address_line2, city, postcode, country, service_address_line1, service_address_line2, service_address_city, service_address_postcode, service_address_country, contact_email, contact_phone, registration_number, registration_jurisdiction, registered_office_line1, registered_office_line2, registered_office_city, registered_office_postcode, registered_office_country, vat_number, verification_status, verification_note, verified_at, verified_by, created_at, updated_at";

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function normalizeSellerLegalInput(input: Record<keyof SellerLegalInput, string | null | undefined>): SellerLegalInput {
  return {
    legal_name: clean(input.legal_name),
    entity_type: clean(input.entity_type) as SellerEntityType,
    address_line1: clean(input.address_line1),
    address_line2: clean(input.address_line2) || null,
    city: clean(input.city),
    postcode: clean(input.postcode).toUpperCase(),
    country: clean(input.country),
    service_address_line1: clean(input.service_address_line1) || null,
    service_address_line2: clean(input.service_address_line2) || null,
    service_address_city: clean(input.service_address_city) || null,
    service_address_postcode: clean(input.service_address_postcode).toUpperCase() || null,
    service_address_country: clean(input.service_address_country) || null,
    contact_email: clean(input.contact_email).toLowerCase(),
    contact_phone: clean(input.contact_phone) || null,
    registration_number: clean(input.registration_number).toUpperCase() || null,
    registration_jurisdiction: clean(input.registration_jurisdiction) || null,
    registered_office_line1: clean(input.registered_office_line1) || null,
    registered_office_line2: clean(input.registered_office_line2) || null,
    registered_office_city: clean(input.registered_office_city) || null,
    registered_office_postcode: clean(input.registered_office_postcode).toUpperCase() || null,
    registered_office_country: clean(input.registered_office_country) || null,
    vat_number: clean(input.vat_number).toUpperCase() || null,
  };
}

export function sellerLegalValidationError(input: SellerLegalInput) {
  if (!input.legal_name || input.legal_name.length > 200) return "Enter the seller's legal name.";
  if (!SELLER_ENTITY_TYPES.includes(input.entity_type)) return "Choose the seller's legal structure.";
  if (!input.address_line1 || input.address_line1.length > 200 || (input.address_line2?.length ?? 0) > 200) return "Enter a valid business address.";
  if (!input.city || input.city.length > 120 || !input.postcode || input.postcode.length > 30 || !input.country || input.country.length > 100) return "Complete the seller's city, postcode and country.";
  if (!/^\S+@\S+\.\S+$/.test(input.contact_email) || input.contact_email.length > 254) return "Enter a valid business contact email.";
  if ((input.contact_phone?.length ?? 0) > 50) return "Enter a shorter business phone number.";
  if ((input.registration_number?.length ?? 0) > 100 || (input.registration_jurisdiction?.length ?? 0) > 100 || (input.vat_number?.length ?? 0) > 100) return "Enter shorter registration or VAT details.";
  if ((input.registered_office_line1?.length ?? 0) > 200 || (input.registered_office_line2?.length ?? 0) > 200 || (input.registered_office_city?.length ?? 0) > 120 || (input.registered_office_postcode?.length ?? 0) > 30 || (input.registered_office_country?.length ?? 0) > 100) return "Enter a valid registered office address.";
  const hasAnyServiceAddress = Boolean(input.service_address_line1 || input.service_address_line2 || input.service_address_city || input.service_address_postcode || input.service_address_country);
  if ((input.service_address_line1?.length ?? 0) > 200 || (input.service_address_line2?.length ?? 0) > 200 || (input.service_address_city?.length ?? 0) > 120 || (input.service_address_postcode?.length ?? 0) > 30 || (input.service_address_country?.length ?? 0) > 100) return "Enter a valid service address.";
  if (hasAnyServiceAddress && (!input.service_address_line1 || !input.service_address_city || !input.service_address_postcode || !input.service_address_country)) return "Complete the service address or leave all service-address fields blank if it is the same as the business address.";
  if (input.entity_type === "limited_company" || input.entity_type === "llp") {
    if (!input.registration_number) return "Enter the registration number for the company or LLP.";
    if (!input.registration_jurisdiction) return "Enter where the company or LLP is registered.";
    if (!input.registered_office_line1 || !input.registered_office_city || !input.registered_office_postcode || !input.registered_office_country) return "Enter the registered office address for the company or LLP.";
  }
  return null;
}

export function sellerLegalProfileComplete(profile: SellerLegalInput | SellerLegalProfile | null | undefined) {
  return Boolean(profile && !sellerLegalValidationError(profile));
}

export function sellerLegalProfileMatches(profile: SellerLegalProfile | null | undefined, input: SellerLegalInput) {
  if (!profile) return false;
  return (
    profile.legal_name === input.legal_name
    && profile.entity_type === input.entity_type
    && (profile.address_line1 ?? "") === input.address_line1
    && (profile.address_line2 ?? null) === input.address_line2
    && profile.city === input.city
    && profile.postcode === input.postcode
    && profile.country === input.country
    && (profile.service_address_line1 ?? null) === input.service_address_line1
    && (profile.service_address_line2 ?? null) === input.service_address_line2
    && (profile.service_address_city ?? null) === input.service_address_city
    && (profile.service_address_postcode ?? null) === input.service_address_postcode
    && (profile.service_address_country ?? null) === input.service_address_country
    && profile.contact_email === input.contact_email
    && (profile.contact_phone ?? null) === input.contact_phone
    && (profile.registration_number ?? null) === input.registration_number
    && (profile.registration_jurisdiction ?? null) === input.registration_jurisdiction
    && (profile.registered_office_line1 ?? null) === input.registered_office_line1
    && (profile.registered_office_line2 ?? null) === input.registered_office_line2
    && (profile.registered_office_city ?? null) === input.registered_office_city
    && (profile.registered_office_postcode ?? null) === input.registered_office_postcode
    && (profile.registered_office_country ?? null) === input.registered_office_country
    && (profile.vat_number ?? null) === input.vat_number
  );
}

export function sellerEntityLabel(entityType: string) {
  switch (entityType) {
    case "sole_trader": return "Sole trader";
    case "limited_company": return "Limited company";
    case "llp": return "Limited liability partnership (LLP)";
    case "partnership": return "Partnership";
    case "charity_nonprofit": return "Charity / non-profit";
    default: return "Other organisation";
  }
}

export function formatSellerAddress(profile: Pick<SellerLegalInput, "address_line1" | "address_line2" | "city" | "postcode" | "country">) {
  return [profile.address_line1, profile.address_line2, profile.city, profile.postcode, profile.country]
    .map(clean).filter(Boolean).join(", ");
}

export function formatServiceAddress(profile: Pick<SellerLegalInput, "service_address_line1" | "service_address_line2" | "service_address_city" | "service_address_postcode" | "service_address_country">) {
  return [profile.service_address_line1, profile.service_address_line2, profile.service_address_city, profile.service_address_postcode, profile.service_address_country]
    .map(clean).filter(Boolean).join(", ");
}

export function formatRegisteredOffice(profile: Pick<SellerLegalInput, "registered_office_line1" | "registered_office_line2" | "registered_office_city" | "registered_office_postcode" | "registered_office_country">) {
  return [profile.registered_office_line1, profile.registered_office_line2, profile.registered_office_city, profile.registered_office_postcode, profile.registered_office_country]
    .map(clean).filter(Boolean).join(", ");
}
