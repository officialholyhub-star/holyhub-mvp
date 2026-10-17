"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth/require-user";
import { applicationCategoryValue } from "@/lib/application-categories";
import { getListerApplication } from "@/lib/lister-applications";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeSellerLegalInput,
  sellerLegalProfileMatches,
  sellerLegalValidationError,
  SELLER_LEGAL_FIELDS,
  type SellerLegalInput,
  type SellerLegalProfile,
} from "@/lib/seller-legal";

const MAX_EMAIL_LENGTH = 254;

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function messageUrl(kind: "error" | "message", message: string) {
  return `/lister/apply?${kind === "error" ? "edit=1&" : ""}${kind}=${encodeURIComponent(message)}`;
}

function legalDetailsUrl(kind: "error" | "message", message: string) {
  return `/lister/legal-details?${kind}=${encodeURIComponent(message)}`;
}

function isValidEmail(email: string) {
  return email.length <= MAX_EMAIL_LENGTH && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sellerLegalFromFormData(formData: FormData): SellerLegalInput {
  return normalizeSellerLegalInput({
    legal_name: clean(formData.get("legal_name")),
    entity_type: clean(formData.get("entity_type")),
    address_line1: clean(formData.get("address_line1")),
    address_line2: clean(formData.get("address_line2")),
    city: clean(formData.get("city")),
    postcode: clean(formData.get("postcode")),
    country: clean(formData.get("country")),
    service_address_line1: clean(formData.get("service_address_line1")),
    service_address_line2: clean(formData.get("service_address_line2")),
    service_address_city: clean(formData.get("service_address_city")),
    service_address_postcode: clean(formData.get("service_address_postcode")),
    service_address_country: clean(formData.get("service_address_country")),
    contact_email: clean(formData.get("contact_email")),
    contact_phone: clean(formData.get("contact_phone")),
    registration_number: clean(formData.get("registration_number")),
    registration_jurisdiction: clean(formData.get("registration_jurisdiction")),
    registered_office_line1: clean(formData.get("registered_office_line1")),
    registered_office_line2: clean(formData.get("registered_office_line2")),
    registered_office_city: clean(formData.get("registered_office_city")),
    registered_office_postcode: clean(formData.get("registered_office_postcode")),
    registered_office_country: clean(formData.get("registered_office_country")),
    vat_number: clean(formData.get("vat_number")),
  });
}

async function saveLegalProfileForUser(userId: string, input: SellerLegalInput) {
  const admin = createAdminClient();
  const { data, error: lookupError } = await admin.from("seller_legal_profiles")
    .select(SELLER_LEGAL_FIELDS).eq("user_id", userId).maybeSingle();
  if (lookupError) return { error: lookupError, changed: false };
  const existing = data as SellerLegalProfile | null;
  if (sellerLegalProfileMatches(existing, input)) return { error: null, changed: false };
  const { error } = await admin.from("seller_legal_profiles").upsert({
    user_id: userId,
    ...input,
    verification_status: "pending",
    verification_note: null,
    verified_at: null,
    verified_by: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  return { error, changed: !error };
}

export async function saveSellerLegalProfile(formData: FormData) {
  const { user } = await requireRole("lister");
  const sellerLegal = sellerLegalFromFormData(formData);
  const legalError = sellerLegalValidationError(sellerLegal);
  if (legalError) redirect(legalDetailsUrl("error", legalError));
  const saved = await saveLegalProfileForUser(user.id, sellerLegal);
  if (saved.error) {
    console.error("Seller legal profile save failed", { code: saved.error.code, message: saved.error.message });
    redirect(legalDetailsUrl("error", "We couldn't save your seller details. Please try again."));
  }
  revalidatePath("/lister/legal-details");
  revalidatePath("/lister");
  revalidatePath("/marketplace");
  revalidatePath(`/lister/storefront/${user.id}`);
  revalidatePath("/admin/listers");
  revalidatePath("/admin/applications");
  redirect(legalDetailsUrl("message", saved.changed ? "Seller details saved and sent for review." : "Your seller details are already up to date."));
}

export async function submitListerApplication(formData: FormData) {
  const { supabase, user } = await requireUser();
  const { application, error: lookupError } = await getListerApplication(supabase, user.id);
  if (lookupError) redirect(messageUrl("error", "We couldn't load your existing application. Please try again."));
  if (application?.status === "approved") redirect(messageUrl("message", "Your lister application has already been approved."));
  if (application && (clean(formData.get("application_id")) !== application.id || clean(formData.get("application_version")) !== application.updated_at)) redirect(messageUrl("error", "Your application has changed. Refresh this page before resubmitting."));
  if (!application && clean(formData.get("application_id"))) redirect(messageUrl("error", "We couldn't find that application. Please refresh."));

  const businessName = clean(formData.get("business_name"));
  const contactName = clean(formData.get("contact_name"));
  const email = clean(formData.get("email")).toLowerCase();
  const websiteOrSocial = clean(formData.get("website_or_social"));
  const description = clean(formData.get("description"));
  const categoryType = applicationCategoryValue(clean(formData.get("category_type")), clean(formData.get("suggested_category")), application?.category_type);
  const acceptedListerTerms = formData.get("accept_lister_terms") === "on";
  const sellerLegal = sellerLegalFromFormData(formData);
  const legalError = sellerLegalValidationError(sellerLegal);

  if (!acceptedListerTerms) redirect(messageUrl("error", "Please agree to the HolyHub Lister Terms before applying."));
  if (!businessName || businessName.length > 150 || !contactName || contactName.length > 100) redirect(messageUrl("error", "Enter a business name and contact name within the limits shown."));
  if (!isValidEmail(email)) redirect(messageUrl("error", "Enter a valid email address."));
  if (websiteOrSocial.length > 500) redirect(messageUrl("error", "Enter a website or social media link within the limit shown."));
  if (!description || description.length > 500 || !categoryType) redirect(messageUrl("error", "Complete the description and product/category type within the limits shown."));
  if (legalError) redirect(messageUrl("error", legalError));

  const values = { business_name: businessName, contact_name: contactName, email, website_or_social: websiteOrSocial || "Not provided", description, category_type: categoryType };
  const result = application
    ? await createAdminClient().from("lister_applications").update({
        ...values, status: "pending", rejection_reason: null, reviewed_at: null,
        updated_at: new Date(Math.max(Date.now(), new Date(application.updated_at).getTime() + 1)).toISOString(),
      }).eq("id", application.id).eq("user_id", user.id).eq("status", application.status).eq("updated_at", application.updated_at).select("id").maybeSingle()
    : await supabase.from("lister_applications").insert({ ...values, user_id: user.id });
  const { error } = result;
  if (application && !error && !result.data) redirect(messageUrl("error", "Your application changed. Refresh to see its current status."));
  if (error) console.error("Lister application save failed", { code: error.code, message: error.message, details: error.details, hint: error.hint });
  if (error?.code === "PGRST205") redirect(messageUrl("error", "Lister applications are not set up yet. Please contact HolyHub support."));
  if (error?.code === "42501") redirect(messageUrl("error", application ? "We couldn't save your application. Please contact HolyHub support." : "You do not have permission to submit a lister application."));
  if (error?.code === "23505") redirect(messageUrl("message", "You already have an active application under review."));
  if (error) redirect(messageUrl("error", "We couldn't submit your application. Please try again."));

  const legalSave = await saveLegalProfileForUser(user.id, sellerLegal);
  if (legalSave.error) {
    console.error("Seller legal profile save failed after application save", { code: legalSave.error.code, message: legalSave.error.message });
    redirect(messageUrl("error", "Your application was saved, but your seller legal details were not. Please submit again before review."));
  }

  revalidatePath("/lister/apply");
  revalidatePath("/account");
  revalidatePath("/admin/applications");
  redirect(messageUrl("message", application?.status === "pending" ? "Your changes have been saved. Your application is still under review." : application ? "Your application has been resubmitted for review." : "Your application has been submitted for review."));
}
