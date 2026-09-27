import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updatePassword } from "@/app/auth/actions";
import { PasswordInput } from "@/components/password-input";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/forgot-password?error=Please%20request%20a%20new%20reset%20link.");

  return (
    <section className="auth-wrap">
      <div className="card">
        <div className="card-header">
          <h2>Choose a new password</h2>
          <p>Use at least 8 characters.</p>
        </div>
        {params.error && <p className="notice notice-error">{params.error}</p>}
        <form className="form" action={updatePassword}>
          <div className="field">
            <label htmlFor="password">New password</label>
            <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} required />
          </div>
          <div className="field">
            <label htmlFor="confirm_password">Confirm new password</label>
            <PasswordInput id="confirm_password" name="confirm_password" autoComplete="new-password" minLength={8} required />
          </div>
          <button className="button button-primary" type="submit">Update password</button>
        </form>
      </div>
    </section>
  );
}
