"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

import { safeInternalPath } from "@/lib/auth/redirect";
import { authOrigin } from "@/lib/auth/origin";
import { hasRecoveryProof, INVALID_RECOVERY_LINK, RECOVERY_COOKIE } from "@/lib/auth/recovery";

const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function raw(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function isValidEmail(email: string) {
  return email.length <= MAX_EMAIL_LENGTH && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPasswordLength(password: string) {
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
}

function messageUrl(path: string, kind: "error" | "message", message: string) {
  return `${path}?${kind}=${encodeURIComponent(message)}`;
}

async function getSiteUrl() {
  return authOrigin(await headers());
}

export async function login(formData: FormData) {
  const requestedNext = safeInternalPath(clean(formData.get("next")), "/account");
  const next = requestedNext.startsWith("/auth/") ? "/account" : requestedNext;
  const loginError = (message: string) => `${messageUrl("/auth/login", "error", message)}&next=${encodeURIComponent(next)}`;
  const email = clean(formData.get("email")).toLowerCase();
  const password = raw(formData.get("password"));

  if (!isValidEmail(email) || !password || password.length > MAX_PASSWORD_LENGTH) {
    redirect(loginError("We couldn't log you in. Check your details and try again."));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error?.code === "email_not_confirmed") redirect(loginError("Confirm your email before logging in. Use Resend confirmation below if you need a new link."));
  if (error) redirect(loginError("We couldn't log you in. Check your details and try again."));

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signup(formData: FormData): Promise<{ error?: string; next?: string; userId?: string }> {
  const fullName = clean(formData.get("full_name"));
  const email = clean(formData.get("email")).toLowerCase();
  const password = raw(formData.get("password"));
  const confirmPassword = raw(formData.get("confirm_password"));
  const acceptedTerms = formData.get("accept_terms") === "on";
  const confirmedAdult = formData.get("confirm_age_18") === "on";

  if (!confirmedAdult) return { error: "You must confirm that you are 18 or over to create a HolyHub account." };
  if (!acceptedTerms) return { error: "Please agree to the HolyHub terms to create an account." };
  if (!isValidEmail(email)) return { error: "Enter a valid email address." };
  if (!fullName) return { error: "Enter your first name." };
  if (fullName.length > 100) return { error: "Name is too long." };
  if (!isValidPasswordLength(password)) {
    return { error: "Use a password between 12 and 128 characters." };
  }
  if (password !== confirmPassword) return { error: "Your passwords don't match." };

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, age_18_plus_confirmed: true },
      emailRedirectTo: `${siteUrl}/auth/callback?next=/account`,
    },
  });

  if (error) {
    return { error: "We couldn't use that email address. Check it's correct and try again." };
  }

  if (!data.session) {
    return { next: "/auth/check-email" };
  }

  revalidatePath("/", "layout");
  return { next: "/account", userId: data.user?.id };
}

export async function resendSignupConfirmation(formData: FormData) {
  const email = clean(formData.get("email")).toLowerCase();
  if (!isValidEmail(email)) {
    redirect(messageUrl("/auth/check-email", "error", "Enter a valid email address."));
  }

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${siteUrl}/auth/callback?next=/account` },
  });

  if (error) redirect(messageUrl("/auth/check-email", "error", "We couldn’t request another email. Wait a minute and try again, or contact HolyHub if this continues."));
  redirect(messageUrl("/auth/check-email", "message", "If that account still needs confirmation, we’ve requested a new email. Check your inbox and spam folder."));
}

export async function requestPasswordReset(formData: FormData) {
  const email = clean(formData.get("email")).toLowerCase();
  if (!isValidEmail(email)) redirect(messageUrl("/auth/forgot-password", "error", "Enter a valid email address."));

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
  });

  if (error) redirect(messageUrl("/auth/forgot-password", "error", "We couldn’t send the reset email. Please try again."));

  redirect(messageUrl("/auth/forgot-password", "message", "We’ve sent you a password reset link. Check your inbox and spam folder."));
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !hasRecoveryProof(cookieStore.get(RECOVERY_COOKIE)?.value, user.id)) {
    redirect(messageUrl("/auth/forgot-password", "error", INVALID_RECOVERY_LINK));
  }
  const password = raw(formData.get("password"));
  const confirmPassword = raw(formData.get("confirm_password"));
  if (password.length < MIN_PASSWORD_LENGTH) {
    redirect(messageUrl("/auth/reset-password", "error", "Your password must be at least 12 characters."));
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    redirect(messageUrl("/auth/reset-password", "error", "Your password must be no more than 128 characters."));
  }
  if (password !== confirmPassword) redirect(messageUrl("/auth/reset-password", "error", "Your passwords don’t match."));

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (["session_not_found", "session_expired", "refresh_token_not_found", "refresh_token_already_used"].includes(error.code || "") || error.status === 401 || error.status === 403) {
      cookieStore.set(RECOVERY_COOKIE, "", { path: "/auth", maxAge: 0 });
      redirect(messageUrl("/auth/forgot-password", "error", INVALID_RECOVERY_LINK));
    }
    const message = error.code === "same_password"
      ? "Choose a different password from your current password."
      : error.code === "weak_password"
        ? "Choose a stronger password with letters, numbers and symbols."
        : "We couldn’t update your password. Please try again.";
    redirect(messageUrl("/auth/reset-password", "error", message));
  }

  cookieStore.set(RECOVERY_COOKIE, "", { path: "/auth", maxAge: 0 });
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(messageUrl("/auth/login", "message", "Your password has been updated."));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}