"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type Turnstile = {
  render(container: HTMLElement, options: { sitekey: string; callback(token: string): void; "expired-callback"(): void; "error-callback"(): void; "response-field": boolean; size: "compact"; theme: "light" }): string;
  reset(id: string): void;
  remove(id: string): void;
};
declare global { interface Window { turnstile?: Turnstile } }

export function AuthCaptcha() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const container = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null), widget = useRef<string | null>(null);
  const submitted = useRef(false);
  const [error, setError] = useState("");
  const { pending } = useFormStatus();
  const renderWidget = useCallback(() => {
    if (!siteKey || !container.current || !window.turnstile || widget.current !== null) return;
    try {
      widget.current = window.turnstile.render(container.current, {
        sitekey: siteKey, "response-field": false, size: "compact", theme: "light",
        callback: token => { if (input.current) input.current.value = token; setError(""); },
        "expired-callback": () => { if (input.current) input.current.value = ""; },
        "error-callback": () => { if (input.current) input.current.value = ""; setError("The security check could not finish. Refresh the page and try again."); },
      });
    } catch { setError("The security check could not load. Refresh the page and try again."); }
  }, [siteKey]);

  const mountContainer = useCallback((element: HTMLDivElement | null) => {
    if (container.current !== element && widget.current !== null) {
      window.turnstile?.remove(widget.current);
      widget.current = null;
    }
    container.current = element;
    if (element) renderWidget();
  }, [renderWidget]);

  useEffect(() => {
    if (pending) submitted.current = true;
    else if (submitted.current) {
      submitted.current = false;
      if (input.current) input.current.value = "";
      // A server-action redirect may replace the form DOM while the external
      // script stays cached. Recreate the widget against the current container.
      if (widget.current !== null) window.turnstile?.remove(widget.current);
      widget.current = null;
      renderWidget();
    }
  }, [pending, renderWidget]);

  if (!siteKey) return null;
  return <div className="field">
    <p className="muted-small">Complete the security check to continue.</p>
    <div ref={mountContainer} />
    <input ref={input} type="hidden" name="captcha_token" defaultValue="" />
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    <noscript>JavaScript is needed for the security check. Please enable it before signing in or creating an account.</noscript>
    <Script id="holyhub-turnstile" src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={renderWidget} onError={() => setError("The security check could not load. Check your connection and refresh this page.")} />
  </div>;
}
