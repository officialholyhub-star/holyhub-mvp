"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/auth/site-url";
import { safeNextPath } from "@/lib/auth/redirects";
import { requireUser } from "@/lib/auth/require-user";
import { captchaInput } from "@/lib/auth/captcha";

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

export async function login(formData: FormData) {
  const next = safeNextPath(clean(formData.get("next")));
  const loginError = `${messageUrl("/auth/login", "error", "We couldn't log you in. Check your details and try again.")}&next=${encodeURIComponent(next)}`;
  const email = clean(formData.get("email")).toLowerCase();
  const password = raw(formData.get("password"));

  if (!isValidEmail(email) || !password || password.length > MAX_PASSWORD_LENGTH) {
    redirect(loginError);
  }

  const captcha = captchaInput(formData, Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY));
  if (captcha.error) redirect(`${messageUrl("/auth/login", "error", captcha.error)}&next=${encodeURIComponent(next)}`);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken: captcha.token } });
  if (error) redirect(loginError);

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signup(formData: FormData) {
  const next = safeNextPath(clean(formData.get("next")));
  const signupError = (message: string) => `${messageUrl("/auth/signup", "error", message)}&next=${encodeURIComponent(next)}`;
  const fullName = clean(formData.get("full_name"));
  const email = clean(formData.get("email")).toLowerCase();
  const password = raw(formData.get("password"));
  const confirmPassword = raw(formData.get("confirm_password"));

  if (!isValidEmail(email)) redirect(signupError("Enter a valid email address."));
  if (fullName.length > 100) redirect(signupError("Name is too long."));
  if (!isValidPasswordLength(password)) {
    redirect(signupError("Use a password between 8 and 128 characters."));
  }
  if (password !== confirmPassword) redirect(signupError("Your passwords don't match."));

  const captcha = captchaInput(formData, Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY));
  if (captcha.error) redirect(signupError(captcha.error));

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      captchaToken: captcha.token,
      data: { full_name: fullName },
      // With Supabase's normal confirmation email, PKCE returns an auth code here.
      emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    redirect(signupError("We couldn't create your account. Check your details or try again shortly."));
  }

  if (!data.session) {
    redirect(`${messageUrl("/auth/login", "message", "Check your email to confirm your account, then log in. If you already have an account, you can log in or reset your password.")}&next=${encodeURIComponent(next)}`);
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function requestPasswordReset(formData: FormData) {
  const email = clean(formData.get("email")).toLowerCase();
  if (!isValidEmail(email)) redirect(messageUrl("/auth/forgot-password", "error", "Enter a valid email address."));

  const captcha = captchaInput(formData, Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY));
  if (captcha.error) redirect(messageUrl("/auth/forgot-password", "error", captcha.error));

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    captchaToken: captcha.token,
    redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
  });

  if (error) redirect(messageUrl("/auth/forgot-password", "error", "We couldn't request a reset right now. Please try again shortly."));
  // Deliberately generic so the form does not reveal whether an email is registered.
  redirect(messageUrl("/auth/forgot-password", "message", "If that email belongs to a HolyHub account, a reset link is on its way."));
}

export async function updatePassword(formData: FormData) {
  const { supabase } = await requireUser("/auth/reset-password");
  const password = raw(formData.get("password"));
  const confirmPassword = raw(formData.get("confirm_password"));

  if (!isValidPasswordLength(password)) {
    redirect(messageUrl("/auth/reset-password", "error", "Use a password between 8 and 128 characters."));
  }
  if (password !== confirmPassword) redirect(messageUrl("/auth/reset-password", "error", "Your passwords don't match."));

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
