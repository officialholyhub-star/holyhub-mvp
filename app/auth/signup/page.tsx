import Link from "next/link";
import { signup } from "@/app/auth/actions";
import { SubmitButton } from "@/components/submit-button";
import { safeNextPath } from "@/lib/auth/redirects";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  return (
    <section className="auth-wrap">
      <div className="card">
        <div className="card-header">
          <h1 className="form-title">Find your place in HolyHub.</h1>
          <p>Create an account to share your business. Just exploring? <Link href="/businesses" className="text-link">Browse without signing up</Link>.</p>
        </div>
        {params.error && <p className="notice notice-error">{params.error}</p>}
        <form className="form" action={signup}>
          <input type="hidden" name="next" value={next} />
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
          <p className="muted-small">We use your details to provide your account. Read <Link className="text-link" href="/privacy">how we handle your information</Link>.</p>
          <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
        </form>
        <div className="form-footer">
          <span>Already have an account?</span>
          <Link className="text-link" href={`/auth/login?next=${encodeURIComponent(next)}`}>Log in</Link>
        </div>
      </div>
    </section>
  );
}
