import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/auth/redirect";

export function adminNextPath(value: string | null) {
  const next = safeInternalPath(value, "/admin");
  const pathname = new URL(next, "https://holyhub.invalid").pathname;
  return pathname === "/admin" || pathname.startsWith("/admin/") ? next : "/admin";
}

export function mfaPath(step: "setup" | "challenge", next: string) {
  return `/auth/mfa/${step}?next=${encodeURIComponent(adminNextPath(next))}`;
}

export async function getAdminMfaState(supabase: Awaited<ReturnType<typeof createClient>>) {
  // Cookie storage is not proof. Pass the token explicitly so Supabase validates it
  // remotely before returning its assurance level (rather than only decoding it).
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) throw new Error("Admin session could not be verified. Please log in again.");
  const { data: assurance, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(session.access_token);
  if (error || !assurance) throw new Error("Admin session assurance could not be verified. Please try again.");
  const { data, error: factorError } = await supabase.auth.mfa.listFactors();
  if (factorError || !data) throw new Error("Admin authenticator factors could not be verified. Please try again.");
  const factors = data.totp.filter(factor => factor.status === "verified");
  return {
    // Require TOTP enrollment as well as a verified AAL2 session.
    isAal2: assurance.currentLevel === "aal2" && factors.length > 0 &&
      assurance.currentAuthenticationMethods.some(entry => {
        const method = typeof entry === "string" ? entry : entry.method;
        return method === "totp" || method === "mfa/totp";
      }),
    factors,
    allFactors: data.all,
  };
}
