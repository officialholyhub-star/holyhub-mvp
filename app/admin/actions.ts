"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-user";
import { combineReviewFeedback } from "@/lib/product-review";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function reviewProductListing(formData: FormData) {
  await requireRole("admin");
  const productId = clean(formData.get("product_id"));
  const decision = clean(formData.get("decision"));
  const expectedVersion = clean(formData.get("product_version"));
  const presets = formData.getAll("rejection_preset").filter((value): value is string => typeof value === "string");
  const customNote = clean(formData.get("review_note"));
  const reviewReason = combineReviewFeedback(presets, customNote);
  if (!expectedVersion) redirect("/admin/products?error=Refresh%20and%20review%20the%20latest%20listing%20before%20saving%20this%20decision.");
  if (!productId || !["approve", "reject"].includes(decision)) redirect("/admin/products?error=That listing review could not be completed.");
  if (decision === "reject" && !reviewReason) redirect("/admin/products?error=Select a rejection reason or add a custom note.");

  const admin = createAdminClient();
  const reviewedAt = new Date().toISOString();
  const { data: updated, error } = await admin.from("products").update({
    review_status: decision === "approve" ? "approved" : "rejected",
    review_reason: decision === "reject" ? reviewReason : null,
    reviewed_at: reviewedAt,
    updated_at: reviewedAt,
    ...(decision === "reject" ? { is_published: false } : {}),
  }).eq("id", productId).eq("review_status", "pending").eq("updated_at", expectedVersion).select("id").maybeSingle();
  if (error || !updated) redirect("/admin/products?error=We%20could%20not%20confirm%20this%20review.%20The%20listing%20may%20have%20changed%20or%20been%20removed.%20Refresh%20and%20review%20its%20current%20status.");
  if (decision === "approve") {
    const { error: snapshotCleanupError } = await admin.from("product_review_snapshots").delete().eq("product_id", productId);
    if (snapshotCleanupError) console.error("Product review snapshot cleanup failed", snapshotCleanupError);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/admin/applications");
  revalidatePath("/lister/products");
  revalidatePath("/marketplace");
  redirect(`/admin/products?message=Listing%20${decision === "approve" ? "approved" : "returned%20for%20changes"}.&reviewed=${encodeURIComponent(productId)}`);
}