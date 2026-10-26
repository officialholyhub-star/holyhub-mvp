"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { requireAdminMfaIdentity } from "@/lib/auth/require-user";
import { adminNextPath, getAdminMfaState, mfaPath } from "@/lib/auth/admin-mfa";

export type Enrollment = { factorId: string; qrCode: string; secret: string };
export type MfaResult = { error?: string; enrollment?: Enrollment };
const value = (form: FormData, key: string) => typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";

export async function enrollAdminTotp(): Promise<MfaResult> {
  const { supabase } = await requireAdminMfaIdentity();
  const state = await getAdminMfaState(supabase);
  if (state.factors.length && !state.isAal2) redirect(mfaPath("challenge", "/admin/security"));
  // Never delete factors automatically, including abandoned enrollments.
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp", issuer: "HolyHub", friendlyName: `HolyHub authenticator ${randomUUID().slice(0, 8)}`,
  });
  if (error || !data) return { error: "We couldn't start authenticator setup. Try again, or contact HolyHub if this continues." };
  // Only the authenticated enrolling admin receives this one-time secret. Never log/persist it.
  return { enrollment: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret } };
}

export async function verifyAdminTotp(_previous: MfaResult, form: FormData): Promise<MfaResult> {
  const { supabase } = await requireAdminMfaIdentity();
  const state = await getAdminMfaState(supabase);
  const next = adminNextPath(value(form, "next"));
  const factorId = value(form, "factor_id");
  const factor = state.allFactors.find(factor => factor.id === factorId && factor.factor_type === "totp");
  // AAL1 may verify an existing factor, or bootstrap the first one. Adding a backup
  // when an existing TOTP factor is verified requires the existing AAL2 session.
  if (!factor || (factor.status !== "verified" && state.factors.length > 0 && !state.isAal2)) {
    return { error: "Use a verified authenticator to continue. Log in again if your factors have changed." };
  }
  const code = value(form, "code");
  if (!/^\d{6}$/.test(code)) return { error: "Enter the six-digit code from your authenticator app." };
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error || !challenge.data) return { error: "We couldn't start verification. Wait a moment and try again." };
  const verified = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
  if (verified.error) return { error: "That code couldn't be verified. Use a fresh code and try again." };
  // verify() saves the new access/refresh tokens via the SSR cookie adapter.
  // Revalidate that new token server-side; never use a client success flag.
  const updated = await getAdminMfaState(supabase);
  if (!updated.isAal2) return { error: "Your session has not reached the required security level. Please log in and try again." };
  revalidatePath("/", "layout");
  redirect(next);
}
