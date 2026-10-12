import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const RECOVERY_COOKIE = "holyhub-password-recovery";
export const RECOVERY_MAX_AGE = 60 * 60;
export const INVALID_RECOVERY_LINK = "This password reset link has expired or is no longer valid. Request a new one.";

function signature(value: string) {
  const secret = process.env.AUTH_RECOVERY_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Password recovery requires AUTH_RECOVERY_SECRET or SUPABASE_SERVICE_ROLE_KEY.");
  return createHmac("sha256", secret).update(value).digest("hex");
}

// Issued only after Supabase verifies the email link; an ordinary login is insufficient.
export function createRecoveryProof(userId: string) {
  const value = `${userId}.${Date.now() + RECOVERY_MAX_AGE * 1000}`;
  return `${value}.${signature(value)}`;
}

export function hasRecoveryProof(proof: string | undefined, userId: string) {
  if (!proof) return false;
  const [id, expires, supplied, ...extra] = proof.split(".");
  if (extra.length || id !== userId || !/^\d+$/.test(expires) || Number(expires) <= Date.now() || !/^[a-f0-9]{64}$/.test(supplied ?? "")) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(signature(`${id}.${expires}`)));
}
