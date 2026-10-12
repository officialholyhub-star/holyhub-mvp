import { cookies } from "next/headers";
import { hasRecoveryProof, INVALID_RECOVERY_LINK, RECOVERY_COOKIE } from "@/lib/auth/recovery";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updatePassword } from "@/app/auth/actions";
import { PasswordInput } from "@/components/password-input";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  if (!user || !hasRecoveryProof(cookieStore.get(RECOVERY_COOKIE)?.value, user.id)) redirect(`/auth/forgot-password?error=${encodeURIComponent(INVALID_RECOVERY_LINK)}`);

  return (
    <section className="auth-wrap">
      <div className="card">
        <div className="card-header">
          <h2>Set new password</h2>
          <p>Use at least 8 characters.</p>
        </div>
        {params.error && <p role="alert" className="notice notice-error">{params.error}</p>}
        <form className="form" action={updatePassword} noValidate>
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
