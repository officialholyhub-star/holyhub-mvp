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
  const presets = formData.getAll("rejection_preset").filter((value): value is string => typeof value === "string");
  const customNote = clean(formData.get("review_note"));
  const reviewReason = combineReviewFeedback(presets, customNote);
  if (!productId || !["approve", "reject"].includes(decision)) redirect("/admin/products?error=That listing review could not be completed.");
  if (decision === "reject" && !reviewReason) redirect("/admin/products?error=Select a rejection reason or add a custom note.");

  const admin = createAdminClient();
  const reviewedAt = new Date().toISOString();
  const { error } = await admin.from("products").update({
    review_status: decision === "approve" ? "approved" : "rejected",
    review_reason: decision === "reject" ? reviewReason : null,
    reviewed_at: reviewedAt,
    updated_at: reviewedAt,
    ...(decision === "reject" ? { is_published: false } : {}),
  }).eq("id", productId).eq("review_status", "pending");
  if (error) redirect("/admin/products?error=We could not update that listing.");
  if (decision === "approve") {
    const { error: snapshotCleanupError } = await admin.from("product_review_snapshots").delete().eq("product_id", productId);
    if (snapshotCleanupError) console.error("Product review snapshot cleanup failed", snapshotCleanupError);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/admin/applications");
  revalidatePath("/lister/products");
  revalidatePath("/marketplace");
  redirect(`/admin/products?message=Listing%20${decision === "approve" ? "approved" : "returned%20for%20changes"}.`);
}