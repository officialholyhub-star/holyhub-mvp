"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function updateProfile(formData: FormData) {
  const fullName = clean(formData.get("full_name"));
  if (fullName.length > 100) redirect("/account?error=Name%20is%20too%20long.");

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName || null, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) redirect("/account?error=We%20couldn't%20save%20your%20profile.");
  revalidatePath("/account");
  redirect("/account?message=Profile%20updated.");
}

export async function updateEmail(formData: FormData) {
  const email = clean(formData.get("email")).toLowerCase();
  if (!email || !email.includes("@")) redirect("/account?error=Enter%20a%20valid%20email.");

  const { supabase } = await requireUser();
  const { error } = await supabase.auth.updateUser({ email });
  if (error) redirect("/account?error=We%20couldn't%20update%20your%20email.");

  redirect("/account?message=Check%20your%20email%20to%20confirm%20the%20change.");
}
