"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-user";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function reviewListerApplication(formData: FormData) {
  await requireRole("admin");

  const applicationId = clean(formData.get("application_id"));
  const expectedVersion = clean(formData.get("application_version"));
  const decision = clean(formData.get("decision"));
  const rejectionReason = clean(formData.get("rejection_reason"));
  if (!applicationId || !expectedVersion || !["approve", "reject"].includes(decision)) {
    redirect("/admin/applications?error=That review could not be completed.");
  }
  if (decision === "reject" && (!rejectionReason || rejectionReason.length > 1000)) {
    redirect("/admin/applications?error=Add a short reason before rejecting an application.");
  }

  const admin = createAdminClient();
  const { data: application, error: lookupError } = await admin
    .from("lister_applications")
    .select("id, user_id, status, updated_at")
    .eq("id", applicationId)
    .maybeSingle();

  if (lookupError || !application) redirect("/admin/applications?error=Application not found.");
  if (application.status !== "pending") redirect("/admin/applications?error=That application has already been reviewed.");

  if (application.updated_at !== expectedVersion) redirect("/admin/applications?error=This%20application%20has%20changed.%20Refresh%20and%20review%20the%20latest%20details.");

  const reviewedAt = new Date().toISOString();
  const nextStatus = decision === "approve" ? "approved" : "rejected";
  const { data: updatedApplication, error: updateError } = await admin
    .from("lister_applications")
    .update({
      status: nextStatus,
      rejection_reason: decision === "reject" ? rejectionReason : null,
      reviewed_at: reviewedAt,
      updated_at: reviewedAt,
    })
    .eq("id", application.id)
    .eq("status", "pending")
    .eq("updated_at", expectedVersion)
    .select("id").maybeSingle();

  if (updateError) redirect("/admin/applications?error=We could not update that application.");

  if (!updatedApplication) redirect("/admin/applications?error=This%20application%20changed%20during%20review.%20Refresh%20before%20trying%20again.");

  if (decision === "approve") {
    const { error: roleError } = await admin
      .from("user_roles")
      .upsert({ user_id: application.user_id, role: "lister" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (roleError) {
      console.error("Lister approval role grant failed", { code: roleError.code, message: roleError.message });
      const { data: restored, error: restoreError } = await admin.from("lister_applications").update({ status: "pending", reviewed_at: null, updated_at: new Date().toISOString() }).eq("id", application.id).eq("status", "approved").eq("updated_at", reviewedAt).select("id").maybeSingle();
      if (restoreError || !restored) redirect("/admin/applications?error=Approval%20could%20not%20be%20completed%20or%20its%20status%20confirmed.%20Refresh%20and%20check%20the%20application%20and%20lister%20access.");
      redirect("/admin/applications?error=The application was not approved because lister access could not be granted.");
    }
  }

  revalidatePath("/admin/applications");
  revalidatePath("/lister/apply");
  revalidatePath("/account");
  redirect(`/admin/applications?message=Application%20${decision === "approve" ? "approved" : "returned%20for%20changes"}.&reviewed=${encodeURIComponent(applicationId)}`);
}
