"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { validateBusiness, type BusinessFormState } from "@/lib/businesses";

export async function saveBusiness(_previous: BusinessFormState, form: FormData): Promise<BusinessFormState> {
  const { supabase, user } = await requireUser("/account/business");
  const result = validateBusiness(form);
  if (!result.data) return { error: result.error, values: result.values };
  const fields = { ...result.data, faith_confirmed: true };
  const id = form.get("id");
  // Always scope writes to the authenticated owner. RLS enforces the same rule at the database.
  const query = typeof id === "string" && id
    ? supabase.from("businesses").update(fields).eq("id", id).eq("owner_id", user.id)
    : supabase.from("businesses").insert({ ...fields, owner_id: user.id });
  const { data, error } = await query.select("id").single();
  if (error || !data) return {
    error: error?.code === "23505" ? "You already have a listing. Refresh this page to edit it." : "We couldn’t save your listing. Your details are still here; please try again.",
    values: result.values,
  };
  revalidatePath("/businesses", "layout");
  revalidatePath("/account");
  revalidatePath("/admin");
  redirect("/account/business?message=Your%20listing%20has%20been%20saved.%20Check%20its%20review%20status%20below.");
}
