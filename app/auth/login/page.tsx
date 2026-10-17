import { safeInternalPath } from "@/lib/auth/redirect";
import Link from "next/link";
import { login } from "@/app/auth/actions";
import { PasswordInput } from "@/components/password-input";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const params = await searchParams;
  return (
    <section className="auth-wrap">
      <div className="card">
        <div className="card-header">
          <p className="eyebrow">Welcome back</p>
          <h2>Log in to HolyHub</h2>
        </div>
        {params.error && <p className="notice notice-error">{params.error}</p>}
        {params.message && <p role="status" className="notice notice-info">{params.message}</p>}
        <form className="form" action={login}>
          <input type="hidden" name="next" value={safeInternalPath(params.next ?? null, "/account")} />
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <PasswordInput id="password" name="password" autoComplete="current-password" required />
          </div>
          <button className="button button-primary" type="submit">Log in</button>
        </form>
        <div className="form-footer">
          <Link className="text-link" href="/auth/forgot-password">Forgot password?</Link>
          <Link className="text-link" href="/auth/check-email">Resend confirmation email</Link>
          <span>New here? <Link className="text-link" href="/auth/signup">Create an account</Link></span>
        </div>
      </div>
    </section>
  );
}
