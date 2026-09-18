import Link from "next/link";
import { resendSignupConfirmation } from "@/app/auth/actions";

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const isDevelopment = process.env.NODE_ENV === "development";

  return (
    <section className="auth-wrap">
      <div className="card check-email-card">
        <div className="check-email-icon" aria-hidden="true">✉</div>
        <p className="eyebrow">One more step</p>
        <h1>Check your email</h1>
        <p className="lead">We sent a confirmation link to the email address you used.</p>
        <ol className="confirmation-steps">
          <li>Open the email from HolyHub.</li>
          <li>Click the confirmation link.</li>
          <li>Return to HolyHub and log in.</li>
        </ol>
        {isDevelopment && (
          <p className="notice notice-info">
            Testing in Codespaces? Open the link in the browser where you are signed in to GitHub, or make port 3000 public first.
          </p>
        )}
        {params.error && <p className="notice notice-error">{params.error}</p>}
        {params.message && <p className="notice notice-success">{params.message}</p>}
        <form className="confirmation-resend" action={resendSignupConfirmation}>
          <label htmlFor="confirmation_email">Need another email?</label>
          <div>
            <input id="confirmation_email" name="email" type="email" autoComplete="email" placeholder="Enter your email" required />
            <button className="button button-secondary" type="submit">Resend email</button>
          </div>
        </form>
        <div className="button-row">
          <Link className="button button-primary" href="/auth/login">Go to login</Link>
          <Link className="button button-quiet" href="/">Back to home</Link>
        </div>
        <p className="muted-small">No email? Check your spam or junk folder.</p>
      </div>
    </section>
  );
}
