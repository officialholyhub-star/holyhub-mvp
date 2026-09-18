"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
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
  if (process.env.NODE_ENV === "development") {
    const requestHeaders = await headers();
    const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = forwardedHost || requestHeaders.get("host")?.trim();
    const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();

    if (host && (host === "localhost:3000" || host === "127.0.0.1:3000" || host.endsWith(".app.github.dev"))) {
      const protocol = host.endsWith(".app.github.dev") ? "https" : (forwardedProto || "http");
      return `${protocol}://${host}`;
    }
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function login(formData: FormData) {
  const email = clean(formData.get("email")).toLowerCase();
  const password = raw(formData.get("password"));

  if (!isValidEmail(email) || !password || password.length > MAX_PASSWORD_LENGTH) {
    redirect(messageUrl("/auth/login", "error", "We couldn't log you in. Check your details and try again."));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(messageUrl("/auth/login", "error", "We couldn't log you in. Check your details and try again."));

  revalidatePath("/", "layout");
  redirect("/account");
}

export async function signup(formData: FormData) {
  const fullName = clean(formData.get("full_name"));
  const email = clean(formData.get("email")).toLowerCase();
  const password = raw(formData.get("password"));
  const confirmPassword = raw(formData.get("confirm_password"));

  if (!isValidEmail(email)) redirect(messageUrl("/auth/signup", "error", "Enter a valid email address."));
  if (fullName.length > 100) redirect(messageUrl("/auth/signup", "error", "Name is too long."));
  if (!isValidPasswordLength(password)) {
    redirect(messageUrl("/auth/signup", "error", "Use a password between 8 and 128 characters."));
  }
  if (password !== confirmPassword) redirect(messageUrl("/auth/signup", "error", "Your passwords don't match."));

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      // With Supabase's normal confirmation email, PKCE returns an auth code here.
      emailRedirectTo: `${siteUrl}/auth/callback?next=/account`,
    },
  });

  if (error) {
    redirect(messageUrl("/auth/signup", "error", "We couldn't use that email address. Check it's correct and try again."));
  }

  if (!data.session) {
    redirect("/auth/check-email");
  }

  revalidatePath("/", "layout");
  redirect("/account");
}

export async function requestPasswordReset(formData: FormData) {
  const email = clean(formData.get("email")).toLowerCase();
  if (!isValidEmail(email)) redirect(messageUrl("/auth/forgot-password", "error", "Enter a valid email address."));

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
  });

  // Deliberately generic so the form does not reveal whether an email is registered.
  redirect(messageUrl("/auth/forgot-password", "message", "If that email belongs to a HolyHub account, a reset link is on its way."));
}

export async function updatePassword(formData: FormData) {
  const password = raw(formData.get("password"));
  const confirmPassword = raw(formData.get("confirm_password"));

  if (!isValidPasswordLength(password)) {
    redirect(messageUrl("/auth/reset-password", "error", "Use a password between 8 and 128 characters."));
  }
  if (password !== confirmPassword) redirect(messageUrl("/auth/reset-password", "error", "Your passwords don't match."));

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(messageUrl("/auth/reset-password", "error", "We couldn't update your password. Request a new reset link and try again."));

  redirect(messageUrl("/account", "message", "Password updated."));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
