import { type NextRequest, NextResponse } from "next/server";
import { safeInternalPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

import { authOrigin } from "@/lib/auth/origin";
import { createRecoveryProof, INVALID_RECOVERY_LINK, RECOVERY_COOKIE, RECOVERY_MAX_AGE } from "@/lib/auth/recovery";
const INVALID_SIGN_IN_LINK = "The sign-in link is invalid or has expired.";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const requestedNext = safeInternalPath(url.searchParams.get("next"), "/account");
  const isRecovery = requestedNext === "/auth/reset-password" || type === "recovery";
  const next = isRecovery ? "/auth/reset-password" : requestedNext;
  const redirectOrigin = authOrigin(request.headers, request.nextUrl.origin);

  if (
    url.searchParams.has("error") ||
    url.searchParams.has("error_code") ||
    url.searchParams.has("error_description")
  ) {
    return recoveryError(redirectOrigin, isRecovery);
  }

  if (code || (tokenHash && type === "recovery")) {
    const supabase = await createClient();
    const { data, error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash! });
    if (!error && data.user) {
      const response = NextResponse.redirect(new URL(next, redirectOrigin));
      if (isRecovery) response.cookies.set(RECOVERY_COOKIE, createRecoveryProof(data.user.id), {
        httpOnly: true, secure: new URL(redirectOrigin).protocol === "https:",
        sameSite: "lax", path: "/auth", maxAge: RECOVERY_MAX_AGE,
      });
      return response;
    }
  }

  return recoveryError(redirectOrigin, isRecovery);
}

function recoveryError(origin: string, isRecovery: boolean) {
  const path = isRecovery ? "/auth/forgot-password" : "/auth/login";
  const message = isRecovery ? INVALID_RECOVERY_LINK : INVALID_SIGN_IN_LINK;
  const response = NextResponse.redirect(new URL(`${path}?error=${encodeURIComponent(message)}`, origin));
  if (isRecovery) response.cookies.set(RECOVERY_COOKIE, "", { path: "/auth", maxAge: 0 });
  return response;
}
