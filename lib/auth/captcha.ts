// This bounds form input only. Supabase must verify the token using its configured
// CAPTCHA provider; never treat a non-empty token as proof that verification passed.
export function captchaInput(form: FormData, enabled: boolean): { token?: string; error?: string } {
  if (!enabled) return {};
  const token = form.get("captcha_token");
  if (typeof token !== "string" || token.length === 0 || token.length > 2048 || /\s/.test(token)) {
    return { error: "Complete the security check before continuing. If it does not load, refresh this page." };
  }
  return { token };
}
