function configuredOrigin(value: string | undefined) {
  if (!value) throw new Error("NEXT_PUBLIC_SITE_URL is not configured.");
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hostname === "0.0.0.0") {
    throw new Error("Invalid checkout site origin.");
  }
  return url.origin;
}

export function checkoutOrigin(requestHeaders: Headers) {
  // Production uses a deployment-controlled URL, never a client-supplied Origin.
  if (process.env.NODE_ENV === "development") {
    const host = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host"))?.split(",")[0]?.trim();
    const codespace = process.env.CODESPACE_NAME;
    if (host && codespace && host.startsWith(`${codespace}-`) && /^\d+\.app\.github\.dev$/.test(host.slice(codespace.length + 1))) {
      return `https://${host}`;
    }
    if (host && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) {
      // A Codespaces proxy can expose an internal loopback Host. Prefer its
      // configured public origin rather than sending the browser to that host.
      if (codespace) return configuredOrigin(process.env.NEXT_PUBLIC_SITE_URL);
      return `http://${host}`;
    }
  }
  return configuredOrigin(process.env.NEXT_PUBLIC_SITE_URL);
}

export function checkoutRedirectUrls(requestHeaders: Headers) {
  const origin = checkoutOrigin(requestHeaders);
  return {
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/cancelled`,
  };
}
