import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = new URL("/auth/login", getRedirectOrigin(request));
  url.searchParams.set("error", "This HolyHub account is currently unavailable.");

  return NextResponse.redirect(url);
}
