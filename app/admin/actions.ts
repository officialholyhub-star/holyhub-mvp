"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-user";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function reviewProductListing(formData: FormData) {
  await requireRole("admin");
  const productId = clean(formData.get("product_id"));
  const decision = clean(formData.get("decision"));
  const reviewReason = clean(formData.get("review_reason"));
  if (!productId || !["approve", "reject"].includes(decision)) redirect("/admin/products?error=That listing review could not be completed.");
  if (decision === "reject" && (!reviewReason || reviewReason.length > 1000)) redirect("/admin/products?error=Add a short reason before rejecting a listing.");

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
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/admin/applications");
  revalidatePath("/lister/products");
  revalidatePath("/marketplace");
  redirect(`/admin/products?message=Listing%20${decision === "approve" ? "approved" : "returned%20for%20changes"}.`);
}