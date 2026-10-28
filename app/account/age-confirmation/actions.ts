"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { safeInternalPath } from "@/lib/auth/redirect";
import { createAdminClient } from "@/lib/supabase/admin";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function confirmationUrl(next: string, message: string) {
  return `/account/age-confirmation?next=${encodeURIComponent(next)}&error=${encodeURIComponent(message)}`;
}

export async function confirmAdultStatus(formData: FormData) {
  const next = safeInternalPath(clean(formData.get("next")), "/account");
  if (formData.get("confirm_age_18") !== "on") {
    redirect(confirmationUrl(next, "You must confirm that you are 18 or over to continue."));
  }

  const { user, profile } = await requireUser();
  if (profile.age_18_plus_confirmed_at) redirect(next);

  const confirmedAt = new Date().toISOString();
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ age_18_plus_confirmed_at: confirmedAt, updated_at: confirmedAt })
    .eq("id", user.id);

  if (error) {
    console.error("Adult confirmation save failed", { code: error.code, message: error.message });
    redirect(confirmationUrl(next, "We couldn’t save your confirmation. Please try again."));
  }

  revalidatePath("/account", "layout");
  revalidatePath("/basket");
  revalidatePath("/lister", "layout");
  redirect(next);
}
