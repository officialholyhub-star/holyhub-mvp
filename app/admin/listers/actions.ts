"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { SELLER_LEGAL_FIELDS, sellerLegalProfileComplete, type SellerLegalProfile } from "@/lib/seller-legal";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function verifySellerLegalProfile(formData: FormData) {
  const { user } = await requireRole("admin");
  const sellerUserId = clean(formData.get("seller_user_id"));
  const verificationNote = clean(formData.get("verification_note"));
  if (!/^[0-9a-f-]{36}$/i.test(sellerUserId)) redirect("/admin/listers?error=Invalid%20seller%20account.");
  if (verificationNote.length < 10 || verificationNote.length > 1000) redirect("/admin/listers?error=Record%20the%20verification%20evidence%20or%20checks%20completed%20before%20approving.");

  const admin = createAdminClient();
  const { data, error } = await admin.from("seller_legal_profiles").select(SELLER_LEGAL_FIELDS).eq("user_id", sellerUserId).maybeSingle();
  const profile = data as SellerLegalProfile | null;
  if (error || !sellerLegalProfileComplete(profile)) redirect("/admin/listers?error=Seller%20legal%20details%20are%20missing%20or%20incomplete.");

  const now = new Date().toISOString();
  const { data: verified, error: verifyError } = await admin.from("seller_legal_profiles").update({
    verification_status: "verified",
    verification_note: verificationNote,
    verified_at: now,
    verified_by: user.id,
    updated_at: now,
  }).eq("user_id", sellerUserId).eq("updated_at", profile!.updated_at).select("user_id").maybeSingle();

  if (verifyError || !verified) redirect("/admin/listers?error=Seller%20details%20changed%20during%20review.%20Refresh%20and%20check%20again.");

  revalidatePath("/admin/listers");
  revalidatePath("/lister");
  revalidatePath("/lister/legal-details");
  revalidatePath("/marketplace");
  revalidatePath(`/lister/storefront/${sellerUserId}`);
  redirect("/admin/listers?message=Seller%20legal%20details%20verified.");
}
