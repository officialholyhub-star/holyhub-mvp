import { type NextRequest, NextResponse } from "next/server";
import { safeInternalPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

const INVALID_RECOVERY_LINK = "This password reset link is invalid or has expired. Please request a new one.";
const INVALID_SIGN_IN_LINK = "The sign-in link is invalid or has expired.";

function getRedirectOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();

  if (
    process.env.NODE_ENV === "development" &&
    forwardedHost?.endsWith(".app.github.dev")
  ) {
    return `https://${forwardedHost}`;
  }

  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredSiteUrl) return configuredSiteUrl;

  const host = request.headers.get("host")?.trim();
  if (host === "localhost:3000" || host === "127.0.0.1:3000") {
    return `${forwardedProto || "http"}://${host}`;
  }

  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const requestedNext = safeInternalPath(url.searchParams.get("next"), "/account");
  const isRecovery = requestedNext === "/auth/reset-password" || type === "recovery";
  const next = isRecovery ? "/auth/reset-password" : requestedNext;
  const redirectOrigin = getRedirectOrigin(request);

  if (
    url.searchParams.has("error") ||
    url.searchParams.has("error_code") ||
    url.searchParams.has("error_description")
  ) {
    return recoveryError(redirectOrigin, isRecovery);
  }

  if (code || (tokenHash && type === "recovery")) {
    const supabase = await createClient();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash! });
    if (!error) return NextResponse.redirect(new URL(next, redirectOrigin));
  }

  return recoveryError(redirectOrigin, isRecovery);
}

function recoveryError(origin: string, isRecovery: boolean) {
  const path = isRecovery ? "/auth/forgot-password" : "/auth/login";
  const message = isRecovery ? INVALID_RECOVERY_LINK : INVALID_SIGN_IN_LINK;
  return NextResponse.redirect(
    new URL(`${path}?error=${encodeURIComponent(message)}`, origin),
  );
}
