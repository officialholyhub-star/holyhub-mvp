"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { applicationCategoryValue } from "@/lib/application-categories";
import { getListerApplication } from "@/lib/lister-applications";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_EMAIL_LENGTH = 254;

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function messageUrl(kind: "error" | "message", message: string) {
  return `/lister/apply?${kind === "error" ? "edit=1&" : ""}${kind}=${encodeURIComponent(message)}`;
}

function isValidEmail(email: string) {
  return email.length <= MAX_EMAIL_LENGTH && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function submitListerApplication(formData: FormData) {
  const { supabase, user } = await requireUser();
  const { application, error: lookupError } = await getListerApplication(supabase, user.id);
  if (lookupError) redirect(messageUrl("error", "We couldn't load your existing application. Please try again."));
  if (application?.status === "approved") redirect(messageUrl("message", "Your lister application has already been approved."));
  if (application && (clean(formData.get("application_id")) !== application.id || clean(formData.get("application_version")) !== application.updated_at)) {
    redirect(messageUrl("error", "Your application has changed. Refresh this page before resubmitting."));
  }
  if (!application && clean(formData.get("application_id"))) redirect(messageUrl("error", "We couldn't find that application. Please refresh."));
  const businessName = clean(formData.get("business_name"));
  const contactName = clean(formData.get("contact_name"));
  const email = clean(formData.get("email")).toLowerCase();
  const websiteOrSocial = clean(formData.get("website_or_social"));
  const description = clean(formData.get("description"));
  const categoryType = applicationCategoryValue(clean(formData.get("category_type")), clean(formData.get("suggested_category")), application?.category_type);
  const acceptedListerTerms = formData.get("accept_lister_terms") === "on";

  if (!acceptedListerTerms) redirect(messageUrl("error", "Please agree to the HolyHub Lister Terms before applying."));
  if (!businessName || businessName.length > 150 || !contactName || contactName.length > 100) {
    redirect(messageUrl("error", "Enter a business name and contact name within the limits shown."));
  }
  if (!isValidEmail(email)) redirect(messageUrl("error", "Enter a valid email address."));
  if (websiteOrSocial.length > 500) {
    redirect(messageUrl("error", "Enter a website or social media link within the limit shown."));
  }
  if (!description || description.length > 500 || !categoryType) {
    redirect(messageUrl("error", "Complete the description and product/category type within the limits shown."));
  }

  const values = {
    business_name: businessName,
    contact_name: contactName,
    email,
    // The existing database column requires a non-empty value.
    website_or_social: websiteOrSocial || "Not provided",
    description,
    category_type: categoryType,
  };
  // Applicant UPDATE is not allowed by RLS. Use the existing server-only admin
  // client solely for a pending/rejected record read through the user's client.
  // Ownership, status and version are checked again atomically in the UPDATE.
  const result = application
    ? await createAdminClient().from("lister_applications").update({
        ...values, status: "pending", rejection_reason: null, reviewed_at: null,
        updated_at: new Date(Math.max(Date.now(), new Date(application.updated_at).getTime() + 1)).toISOString(),
      }).eq("id", application.id).eq("user_id", user.id).eq("status", application.status)
        .eq("updated_at", application.updated_at).select("id").maybeSingle()
    : await supabase.from("lister_applications").insert({ ...values, user_id: user.id });
  const { error } = result;
  if (application && !error && !result.data) redirect(messageUrl("error", "Your application changed during submission. Refresh to see its current status."));

  if (error) {
    console.error("Lister application save failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
  }
  if (error?.code === "PGRST205") {
    redirect(messageUrl("error", "Lister applications are not set up yet. Please contact HolyHub support."));
  }
  if (error?.code === "42501") {
    if (application) redirect(messageUrl("error", "We couldn't save your application. Please contact HolyHub support."));
    redirect(messageUrl("error", "You do not have permission to submit a lister application."));
  }
  if (error?.code === "23505") {
    redirect(messageUrl("message", "You already have an active application under review."));
  }
  if (error) redirect(messageUrl("error", "We couldn't submit your application. Please try again."));

  revalidatePath("/lister/apply");
  revalidatePath("/account");
  revalidatePath("/admin/applications");
  redirect(messageUrl("message", application?.status === "pending" ? "Your changes have been saved. Your application is still under review." : application ? "Your application has been resubmitted for review." : "Your application has been submitted for review."));
}
