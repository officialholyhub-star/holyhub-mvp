// Only local paths may be used after authentication, including token-hash links.
export function safeNextPath(value: unknown, fallback = "/account") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\u0000-\u0020]/.test(decoded)) return fallback;
    const parsed = new URL(value, "https://holyhub.invalid");
    if (parsed.origin !== "https://holyhub.invalid" || parsed.pathname.startsWith("//")) return fallback;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallback;
  }
}

export function siteOrigin(configured: string | undefined, fallback = "http://localhost:3000") {
  const url = new URL(configured || fallback);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid site URL");
  return url.origin;
}
