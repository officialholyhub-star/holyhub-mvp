import Link from "next/link";
import { login } from "@/app/auth/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  return (
    <section className="auth-wrap">
      <div className="card">
        <div className="card-header">
          <h2>Log in</h2>
          <p>Welcome back to HolyHub.</p>
        </div>
        {params.error && <p className="notice notice-error">{params.error}</p>}
        {params.message && <p className="notice notice-info">{params.message}</p>}
        <form className="form" action={login}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <button className="button button-primary" type="submit">Log in</button>
        </form>
        <div className="form-footer">
          <Link className="text-link" href="/auth/forgot-password">Forgot password?</Link>
          <Link className="text-link" href="/auth/signup">Create account</Link>
        </div>
      </div>
    </section>
  );
}
