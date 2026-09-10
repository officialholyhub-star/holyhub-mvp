import Link from "next/link";
import { signup } from "@/app/auth/actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <section className="auth-wrap">
      <div className="card">
        <div className="card-header">
          <h2>Create your HolyHub account</h2>
          <p>One account for shopping now and, if approved later, selling too.</p>
        </div>
        {params.error && <p className="notice notice-error">{params.error}</p>}
        <form className="form" action={signup}>
          <div className="field">
            <label htmlFor="full_name">Name</label>
            <input id="full_name" name="full_name" type="text" autoComplete="name" maxLength={100} />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <div className="field">
            <label htmlFor="confirm_password">Confirm password</label>
            <input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <button className="button button-primary" type="submit">Create account</button>
        </form>
        <div className="form-footer">
          <span>Already have an account?</span>
          <Link className="text-link" href="/auth/login">Log in</Link>
        </div>
      </div>
    </section>
  );
}
