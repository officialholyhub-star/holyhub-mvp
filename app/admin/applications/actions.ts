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
  const decision = clean(formData.get("decision"));
  const rejectionReason = clean(formData.get("rejection_reason"));
  if (!applicationId || !["approve", "reject"].includes(decision)) {
    redirect("/admin/applications?error=That review could not be completed.");
  }
  if (decision === "reject" && (!rejectionReason || rejectionReason.length > 1000)) {
    redirect("/admin/applications?error=Add a short reason before rejecting an application.");
  }

  const admin = createAdminClient();
  const { data: application, error: lookupError } = await admin
    .from("lister_applications")
    .select("id, user_id, status")
    .eq("id", applicationId)
    .maybeSingle();

  if (lookupError || !application) redirect("/admin/applications?error=Application not found.");
  if (application.status !== "pending") redirect("/admin/applications?error=That application has already been reviewed.");

  const reviewedAt = new Date().toISOString();
  const nextStatus = decision === "approve" ? "approved" : "rejected";
  const { error: updateError } = await admin
    .from("lister_applications")
    .update({
      status: nextStatus,
      rejection_reason: decision === "reject" ? rejectionReason : null,
      reviewed_at: reviewedAt,
      updated_at: reviewedAt,
    })
    .eq("id", application.id)
    .eq("status", "pending");

  if (updateError) redirect("/admin/applications?error=We could not update that application.");

  if (decision === "approve") {
    const { error: roleError } = await admin
      .from("user_roles")
      .upsert({ user_id: application.user_id, role: "lister" }, { onConflict: "user_id,role" });
    if (roleError) {
      await admin.from("lister_applications").update({ status: "pending", reviewed_at: null, updated_at: new Date().toISOString() }).eq("id", application.id);
      redirect("/admin/applications?error=The application was not approved because lister access could not be granted.");
    }
  }

  revalidatePath("/admin/applications");
  revalidatePath("/lister/apply");
  revalidatePath("/account");
  redirect(`/admin/applications?message=Application%20${decision === "approve" ? "approved" : "returned%20for%20changes"}.`);
}
