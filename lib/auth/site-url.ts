import { headers } from "next/headers";
import { siteOrigin } from "@/lib/auth/redirects";

export async function getSiteUrl() {
  if (process.env.NODE_ENV === "development") {
    const requestHeaders = await headers();
    const host = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host"))?.split(",")[0]?.trim();
    if (host && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return `http://${host}`;
    if (host && /^[a-z0-9-]+\.app\.github\.dev$/.test(host)) return `https://${host}`;
  }
  return siteOrigin(process.env.NEXT_PUBLIC_SITE_URL);
}
