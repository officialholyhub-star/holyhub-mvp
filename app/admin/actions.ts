"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";
import { isUuid } from "@/lib/businesses";

export async function reviewBusiness(form: FormData) {
  const { supabase } = await requireRole("admin");
  const id = form.get("id");
  const decision = form.get("decision");
  const updatedAt = form.get("updated_at");
  if (!isUuid(id) || !["approved", "rejected"].includes(String(decision)) || typeof updatedAt !== "string" || !Number.isFinite(Date.parse(updatedAt))) redirect("/admin?error=Invalid%20review.%20Please%20reload.");
  const { data, error } = await supabase.rpc("review_business", { listing_id: id, decision, expected_updated_at: updatedAt });
  if (error) redirect("/admin?error=We%20couldn%E2%80%99t%20save%20that%20review.%20Please%20try%20again.");
  if (!data) redirect("/admin?error=This%20listing%20changed%20or%20its%20owner%20is%20unavailable.%20Reload%20before%20reviewing.");
  revalidatePath("/businesses", "layout");
  revalidatePath("/account/business");
  revalidatePath("/admin");
  redirect(`/admin?message=${decision === "approved" ? "Listing%20approved." : "Listing%20not%20approved%20and%20hidden%20from%20discovery."}`);
}
