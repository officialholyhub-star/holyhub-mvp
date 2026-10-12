"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";
import { onboardingCookie, onboardingStep } from "@/lib/lister-onboarding";
export async function advanceOnboarding(formData: FormData) {
  const { user } = await requireRole("lister");
  const jar = await cookies();
  const step = onboardingStep(String(formData.get("step") ?? formData.get("resume_step")));
  try { jar.set(onboardingCookie(user.id), `${step}:later`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 31536000 }); } catch { redirect("/lister?error=We%20couldn%E2%80%99t%20save%20your%20setup%20progress.%20Open%20shop%20setup%20to%20continue."); }
  redirect(formData.get("later") ? "/lister" : step === 5 ? "/lister/products/new?onboarding=1" : "/lister/onboarding");
}
