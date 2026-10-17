export const SELLER_ENTITY_TYPES = [
  "sole_trader",
  "limited_company",
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
  contact_email: string;
  contact_phone: string | null;
  registration_number: string | null;
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

export const SELLER_LEGAL_FIELDS = "user_id, legal_name, entity_type, address_line1, address_line2, city, postcode, country, contact_email, contact_phone, registration_number, vat_number, verification_status, verification_note, verified_at, verified_by, created_at, updated_at";

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
    contact_email: clean(input.contact_email).toLowerCase(),
    contact_phone: clean(input.contact_phone) || null,
    registration_number: clean(input.registration_number).toUpperCase() || null,
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
  if ((input.registration_number?.length ?? 0) > 100 || (input.vat_number?.length ?? 0) > 100) return "Enter shorter registration or VAT details.";
  if (input.entity_type === "limited_company" && !input.registration_number) return "Enter the company registration number for a limited company.";
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
    && profile.contact_email === input.contact_email
    && (profile.contact_phone ?? null) === input.contact_phone
    && (profile.registration_number ?? null) === input.registration_number
    && (profile.vat_number ?? null) === input.vat_number
  );
}

export function sellerEntityLabel(entityType: string) {
  switch (entityType) {
    case "sole_trader": return "Sole trader";
    case "limited_company": return "Limited company";
    case "partnership": return "Partnership";
    case "charity_nonprofit": return "Charity / non-profit";
    default: return "Other organisation";
  }
}

export function formatSellerAddress(profile: Pick<SellerLegalInput, "address_line1" | "address_line2" | "city" | "postcode" | "country">) {
  return [profile.address_line1, profile.address_line2, profile.city, profile.postcode, profile.country]
    .map(clean)
    .filter(Boolean)
    .join(", ");
}
