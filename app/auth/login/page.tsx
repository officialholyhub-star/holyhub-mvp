import Link from "next/link";
import { login } from "@/app/auth/actions";
import { SubmitButton } from "@/components/submit-button";
import { safeNextPath } from "@/lib/auth/redirects";
import { AuthCaptcha } from "@/components/auth-captcha";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  return (
    <section className="auth-wrap">
      <div className="card">
        <div className="card-header">
          <h1 className="form-title">Log in</h1>
          <p>Welcome back to HolyHub.</p>
        </div>
        {params.error && <p className="notice notice-error">{params.error}</p>}
        {params.message && <p className="notice notice-info">{params.message}</p>}
        <form className="form" action={login}>
          <input type="hidden" name="next" value={next} />
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <AuthCaptcha />
          <SubmitButton pendingText="Logging in…">Log in</SubmitButton>
        </form>
        <div className="form-footer">
          <Link className="text-link" href="/auth/forgot-password">Forgot password?</Link>
          <Link className="text-link" href={`/auth/signup?next=${encodeURIComponent(next)}`}>Create account</Link>
        </div>
      </div>
    </section>
  );
}
