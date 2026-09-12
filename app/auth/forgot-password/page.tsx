import Link from "next/link";
import { requestPasswordReset } from "@/app/auth/actions";
import { SubmitButton } from "@/components/submit-button";
import { AuthCaptcha } from "@/components/auth-captcha";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  return (
    <section className="auth-wrap">
      <div className="card">
        <div className="card-header">
          <h1 className="form-title">Reset your password</h1>
          <p>Enter the email used for your HolyHub account.</p>
        </div>
        {params.error && <p className="notice notice-error">{params.error}</p>}
        {params.message && <p className="notice notice-success">{params.message}</p>}
        <form className="form" action={requestPasswordReset}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <AuthCaptcha />
          <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
        </form>
        <div className="form-footer">
          <Link className="text-link" href="/auth/login">Back to log in</Link>
        </div>
      </div>
    </section>
  );
}
