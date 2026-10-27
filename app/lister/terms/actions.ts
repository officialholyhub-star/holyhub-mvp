"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";

export async function acceptListerTerms(formData: FormData) {
  if (formData.get("accept_terms") !== "on") {
    redirect("/lister/terms?error=Please%20confirm%20that%20you%20have%20read%20and%20agree%20to%20the%20current%20Lister%20Terms.");
  }

  const { supabase } = await requireRole("lister");
  const displayedVersion = formData.get("terms_version");
  const displayedHash = formData.get("terms_sha256");
  if (typeof displayedVersion !== "string" || !displayedVersion.trim() || displayedVersion.length > 100
    || typeof displayedHash !== "string" || !/^[0-9a-f]{64}$/.test(displayedHash)) {
    redirect("/lister/terms?error=Please%20refresh%20and%20read%20the%20current%20Lister%20Terms%20before%20accepting.");
  }
  const { data: version, error } = await supabase.rpc("accept_current_lister_terms", {
    p_source: "lister_portal",
    p_version: displayedVersion,
    p_sha256: displayedHash,
  });

  if (error?.code === "P0002") {
    redirect("/lister/terms?error=The%20Lister%20Terms%20have%20changed%20or%20are%20unavailable.%20Please%20refresh%20and%20read%20the%20current%20version%20before%20accepting.");
  }

  if (error || version !== displayedVersion) {
    console.error("Lister Terms acceptance failed", { code: error?.code });
    redirect("/lister/terms?error=The%20final%20Lister%20Terms%20are%20not%20available%20for%20acceptance%20yet.%20Please%20try%20again%20later.");
  }

  revalidatePath("/lister/terms");
  revalidatePath("/lister");
  revalidatePath("/marketplace");
  revalidatePath("/");
  redirect(`/lister/terms?message=${encodeURIComponent(`Lister Terms ${version} accepted.`)}`);
}
