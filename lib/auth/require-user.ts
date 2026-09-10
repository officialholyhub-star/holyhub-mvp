import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "customer" | "lister" | "admin";

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth/login?message=Please%20log%20in%20to%20continue.");
  }

  return { supabase, user };
}

export async function requireRole(role: AppRole) {
  const context = await requireUser();
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.user.id)
    .eq("role", role)
    .maybeSingle();

  if (error || !data) {
    redirect("/account?error=You%20do%20not%20have%20access%20to%20that%20area.");
  }

  return context;
}
