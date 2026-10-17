"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-user";
import { SELLER_LEGAL_FIELDS, sellerLegalProfileComplete, type SellerLegalProfile } from "@/lib/seller-legal";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function reviewListerApplication(formData: FormData) {
  const { user } = await requireRole("admin");

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

  let legalProfile: SellerLegalProfile | null = null;
  if (decision === "approve") {
    const { data, error: legalError } = await admin.from("seller_legal_profiles")
      .select(SELLER_LEGAL_FIELDS).eq("user_id", application.user_id).maybeSingle();
    legalProfile = data as SellerLegalProfile | null;
    if (legalError || !sellerLegalProfileComplete(legalProfile)) {
      redirect("/admin/applications?error=Seller%20legal%20details%20must%20be%20complete%20before%20approval.");
    }
  }

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
    const { data: verified, error: verifyError } = await admin.from("seller_legal_profiles").update({
      verification_status: "verified",
      verification_note: null,
      verified_at: reviewedAt,
      verified_by: user.id,
      updated_at: reviewedAt,
    }).eq("user_id", application.user_id).eq("updated_at", legalProfile!.updated_at).select("user_id").maybeSingle();

    if (verifyError || !verified) {
      await admin.from("lister_applications").update({ status: "pending", reviewed_at: null, updated_at: new Date().toISOString() }).eq("id", application.id).eq("status", "approved");
      redirect("/admin/applications?error=Seller%20details%20changed%20during%20review.%20Refresh%20before%20approving.");
    }

    const { error: roleError } = await admin
      .from("user_roles")
      .upsert({ user_id: application.user_id, role: "lister" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (roleError) {
      console.error("Lister approval role grant failed", { code: roleError.code, message: roleError.message });
      const restoreTime = new Date().toISOString();
      const { data: restored, error: restoreError } = await admin.from("lister_applications").update({ status: "pending", reviewed_at: null, updated_at: restoreTime }).eq("id", application.id).eq("status", "approved").select("id").maybeSingle();
      await admin.from("seller_legal_profiles").update({ verification_status: "pending", verification_note: null, verified_at: null, verified_by: null, updated_at: restoreTime }).eq("user_id", application.user_id).eq("verification_status", "verified");
      if (restoreError || !restored) redirect("/admin/applications?error=Approval%20could%20not%20be%20completed%20or%20its%20status%20confirmed.%20Refresh%20and%20check%20the%20application%20and%20lister%20access.");
      redirect("/admin/applications?error=The application was not approved because lister access could not be granted.");
    }
  } else {
    await admin.from("seller_legal_profiles").update({
      verification_status: "rejected",
      verification_note: rejectionReason,
      verified_at: null,
      verified_by: null,
      updated_at: reviewedAt,
    }).eq("user_id", application.user_id);
  }

  revalidatePath("/admin/applications");
  revalidatePath("/admin/listers");
  revalidatePath("/lister/apply");
  revalidatePath("/account");
  revalidatePath("/marketplace");
  redirect(`/admin/applications?message=Application%20${decision === "approve" ? "approved%20and%20seller%20identity%20verified" : "returned%20for%20changes"}.&reviewed=${encodeURIComponent(applicationId)}`);
}
