import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/account";
  }

  return value;
}

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
  const next = safeNextPath(url.searchParams.get("next"));
  const redirectOrigin = getRedirectOrigin(request);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, redirectOrigin));
  }

  return NextResponse.redirect(
    new URL(
      "/auth/login?error=The%20sign-in%20link%20is%20invalid%20or%20has%20expired.",
      redirectOrigin,
    ),
  );
}
