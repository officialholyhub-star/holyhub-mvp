"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";

const MAX_EMAIL_LENGTH = 254;

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function messageUrl(kind: "error" | "message", message: string) {
  return `/lister/apply?${kind}=${encodeURIComponent(message)}`;
}

function isValidEmail(email: string) {
  return email.length <= MAX_EMAIL_LENGTH && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function submitListerApplication(formData: FormData) {
  const businessName = clean(formData.get("business_name"));
  const contactName = clean(formData.get("contact_name"));
  const email = clean(formData.get("email")).toLowerCase();
  const websiteOrSocial = clean(formData.get("website_or_social"));
  const description = clean(formData.get("description"));
  const categoryType = clean(formData.get("category_type"));

  if (!businessName || businessName.length > 150 || !contactName || contactName.length > 100) {
    redirect(messageUrl("error", "Enter a business name and contact name within the limits shown."));
  }
  if (!isValidEmail(email)) redirect(messageUrl("error", "Enter a valid email address."));
  if (!websiteOrSocial || websiteOrSocial.length > 500) {
    redirect(messageUrl("error", "Enter a website or social media link within the limit shown."));
  }
  if (!description || description.length > 500 || !categoryType || categoryType.length > 100) {
    redirect(messageUrl("error", "Complete the description and product/category type within the limits shown."));
  }

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("lister_applications").insert({
    user_id: user.id,
    business_name: businessName,
    contact_name: contactName,
    email,
    website_or_social: websiteOrSocial,
    description,
    category_type: categoryType,
  });

  if (error) {
    console.error("Lister application insert failed", {
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
    redirect(messageUrl("error", "You do not have permission to submit a lister application."));
  }
  if (error?.code === "23505") {
    redirect(messageUrl("message", "You already have an active application under review."));
  }
  if (error) redirect(messageUrl("error", "We couldn't submit your application. Please try again."));

  revalidatePath("/lister/apply");
  revalidatePath("/account");
  redirect(messageUrl("message", "Your application has been submitted for review."));
}