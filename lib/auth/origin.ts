export function authOrigin(requestHeaders: Headers, fallback = "http://localhost:3000") {
  const host = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host"))?.split(",")[0]?.trim();
  if (process.env.NODE_ENV === "development" && host) {
    if (/^[a-z0-9-]+-\d+\.app\.github\.dev$/i.test(host)) return `https://${host}`;
    if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return `http://${host}`;
  }
  return new URL(process.env.NEXT_PUBLIC_SITE_URL || fallback).origin;
}
