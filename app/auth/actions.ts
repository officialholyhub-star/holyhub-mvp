"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function messageUrl(path: string, kind: "error" | "message", message: string) {
  return `${path}?${kind}=${encodeURIComponent(message)}`;
}

export async function login(formData: FormData) {
  const email = clean(formData.get("email")).toLowerCase();
  const password = clean(formData.get("password"));

  if (!email || !password) redirect(messageUrl("/auth/login", "error", "Enter your email and password."));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(messageUrl("/auth/login", "error", "We couldn't log you in. Check your details and try again."));

  revalidatePath("/", "layout");
  redirect("/account");
}

export async function signup(formData: FormData) {
  const fullName = clean(formData.get("full_name"));
  const email = clean(formData.get("email")).toLowerCase();
  const password = clean(formData.get("password"));
  const confirmPassword = clean(formData.get("confirm_password"));

  if (!email || !password) redirect(messageUrl("/auth/signup", "error", "Email and password are required."));
  if (password.length < 8) redirect(messageUrl("/auth/signup", "error", "Use at least 8 characters for your password."));
  if (password !== confirmPassword) redirect(messageUrl("/auth/signup", "error", "Your passwords don't match."));

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${siteUrl}/auth/confirm`,
    },
  });

  if (error) redirect(messageUrl("/auth/signup", "error", "We couldn't create the account. Please try again."));

  if (!data.session) {
    redirect(messageUrl("/auth/login", "message", "Account created. Check your email to confirm it, then log in."));
  }

  revalidatePath("/", "layout");
  redirect("/account");
}

export async function requestPasswordReset(formData: FormData) {
  const email = clean(formData.get("email")).toLowerCase();
  if (!email) redirect(messageUrl("/auth/forgot-password", "error", "Enter your email address."));

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
  });

  // Deliberately generic so the form does not reveal whether an email is registered.
  redirect(messageUrl("/auth/forgot-password", "message", "If that email belongs to a HolyHub account, a reset link is on its way."));
}

export async function updatePassword(formData: FormData) {
  const password = clean(formData.get("password"));
  const confirmPassword = clean(formData.get("confirm_password"));

  if (password.length < 8) redirect(messageUrl("/auth/reset-password", "error", "Use at least 8 characters for your password."));
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
