/**
 * N18 proposed route isolation for a SEPARATE, private CRM deployment.
 *
 * Deliberately not wired into proxy.ts or deployed: A-225/A-226 separate site,
 * staff access, secrets and C13/N19 constraints still need approval/proof.
 * No change to HolyHub's public marketplace request handling.
 */
const allowedPagesAndActions = new Set([
  "/admin/crm",
  "/api/crm/actions",
  "/api/crm/dashboard",
  "/api/crm/operate",
  "/auth/login",
  "/auth/callback",
  "/auth/confirm",
  "/auth/blocked",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/check-email",
]);

const allowedStaticAssets = new Set([
  "/favicon.ico",
  "/holyhub-logo.png",
]);

/** Return only a Boolean decision; the future site-specific proxy owns redirects/403s. */
export function isPermittedPrivateCrmPath(pathname: unknown): boolean {
  if (typeof pathname !== "string" || pathname.length === 0 || pathname[0] !== "/") {
    return false;
  }
  // Deny ambiguous or encoded paths instead of relying on a reverse proxy or
  // framework to normalise URL components consistently.
  if (pathname.includes("\\") || pathname.includes("%") ||
      pathname.includes("?") || pathname.includes("#") ||
      pathname.includes("//") || pathname.includes("\0")) {
    return false;
  }
  const clean = pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1) : pathname;
  if (clean.split("/").some(part => part === "." || part === "..")) return false;

  if (allowedPagesAndActions.has(clean) || allowedStaticAssets.has(clean)) return true;
  // Next's generated JS/CSS and image loader are required for the CRM UI.
  if (clean.startsWith("/_next/static/") && clean.length > "/_next/static/".length) return true;
  if (clean === "/_next/image") return true;

  return false;
}
