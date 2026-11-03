import type { Page } from "@playwright/test";

// Isolated browser-test stand-in only. No real Cloudflare challenge is requested
// or solved; Supabase/provider verification still requires separate live testing.
export async function mockCaptchaWidget(page: Page) {
  await page.route("https://challenges.cloudflare.com/turnstile/**", route => route.fulfill({
    contentType: "application/javascript",
    body: `(() => {
      const widgets = new Map();
      window.turnstile = {
        render(container, options) {
          const id = String(Math.random());
          widgets.set(id, { container, options });
          container.textContent = 'Security check (isolated test)';
          queueMicrotask(() => { if (widgets.has(id)) options.callback('holyhub-test-captcha-token'); });
          return id;
        },
        reset(id) { const widget = widgets.get(id); if (widget) queueMicrotask(() => widget.options.callback('holyhub-test-captcha-token')); },
        remove(id) { const widget = widgets.get(id); if (widget) widget.container.textContent = ''; widgets.delete(id); }
      };
    })();`,
  }));
}
