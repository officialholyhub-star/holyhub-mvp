import { headers } from "next/headers";
import { safeInternalPath } from "@/lib/auth/redirect";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminNextPath, getAdminMfaState, mfaPath } from "@/lib/auth/admin-mfa";

export type AppRole = "customer" | "lister" | "admin";

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    const requestHeaders = await headers();
    let next = "/account";
    try {
      const referer = requestHeaders.get("referer");
      if (referer) { const url = new URL(referer); next = safeInternalPath(`${url.pathname}${url.search}`, "/account"); }
    } catch { /* Use the account page when the referring path is unavailable. */ }
    if (next.startsWith("/auth/")) next = "/account";
    redirect(`/auth/login?message=Please%20log%20in%20to%20continue.&next=${encodeURIComponent(next)}`);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("account_status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw new Error("Account details could not be verified. Please try again.");
  if (!profile || profile.account_status !== "active") {
    redirect("/auth/blocked");
  }

  return { supabase, user };
}

async function requireRoleIdentity(role: AppRole) {
  const context = await requireUser();
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.user.id)
    .eq("role", role)
    .maybeSingle();

  if (error) throw new Error("Access could not be verified. Please try again.");
  if (!data) {
    redirect("/account?error=You%20do%20not%20have%20access%20to%20that%20area.");
  }

  return context;
}

// Bootstrap permission for MFA pages/actions ONLY; never use for admin data or mutations.
export async function requireAdminMfaIdentity() {
  return requireRoleIdentity("admin");
}

export async function requireRole(role: AppRole) {
  const context = await requireRoleIdentity(role);
  if (role === "admin") {
    const state = await getAdminMfaState(context.supabase);
    if (!state.isAal2) {
      const requestHeaders = await headers();
      const next = adminNextPath(requestHeaders.get("x-holyhub-request-path"));
      redirect(mfaPath(state.factors.length ? "challenge" : "setup", next));
    }
  }
  return context;
}
