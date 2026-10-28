import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { safeInternalPath } from "@/lib/auth/redirect";
import { confirmAdultStatus } from "./actions";

export const dynamic = "force-dynamic";

export default async function AgeConfirmationPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const next = safeInternalPath(params.next ?? null, "/account");
  const { profile } = await requireUser();

  if (profile.age_18_plus_confirmed_at) redirect(next);

  return (
    <section className="auth-wrap">
      <div className="card">
        <div className="card-header">
          <p className="eyebrow">HolyHub account</p>
          <h1>Confirm you’re 18 or over</h1>
          <p>HolyHub accounts, buying and selling are for people aged 18 or over.</p>
        </div>
        {params.error && <p className="notice notice-error" role="alert">{params.error}</p>}
        <form className="form" action={confirmAdultStatus}>
          <input type="hidden" name="next" value={next} />
          <label className="terms-consent">
            <input type="checkbox" name="confirm_age_18" required />
            <span>I confirm I am 18 or over.</span>
          </label>
          <button className="button button-primary" type="submit">Confirm and continue</button>
        </form>
        <p className="form-footer">If you’re under 18, you can still browse the public HolyHub marketplace without an account.</p>
      </div>
    </section>
  );
}
