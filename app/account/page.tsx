import { updateEmail, updateProfile } from "./actions";
import { requireUser } from "@/lib/auth/require-user";
import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { MarketNav } from "@/components/market-nav";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const [{ data: profile, error: profileError }, { data: roles, error: roleError }] = await Promise.all([
    supabase.from("profiles").select("full_name, account_status, created_at").eq("id", user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  if (profileError || roleError) throw new Error("Account details unavailable");

  return (
    <section>
      <MarketNav />
      <p className="eyebrow">My HolyHub</p>
      <h1 className="page-title">Your little corner of HolyHub.</h1>
      <p className="lead">Manage your profile, discover businesses and share your own with the community.</p>
      <div className="button-row"><Link className="button button-primary" href="/account/business">Your business listing →</Link><Link className="button button-quiet" href="/businesses">Explore businesses</Link>{roles?.some(({ role }) => role === "admin") && <Link className="button button-secondary" href="/admin">Review listings</Link>}</div>

      {params.error && <p className="notice notice-error" role="alert">{params.error}</p>}
      {params.message && <p className="notice notice-success" role="status">{params.message}</p>}

      <div className="account-grid">
        <div className="card">
          <h2>Profile</h2>
          <form className="form" action={updateProfile}>
            <div className="field">
              <label htmlFor="full_name">Name</label>
              <input id="full_name" name="full_name" type="text" defaultValue={profile?.full_name ?? ""} maxLength={100} />
            </div>
            <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
          </form>
        </div>

        <div className="card">
          <h2>Email</h2>
          <form className="form" action={updateEmail}>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" autoComplete="email" maxLength={254} defaultValue={user.email ?? ""} required />
            </div>
            <SubmitButton className="button button-secondary" pendingText="Updating…">Change email</SubmitButton>
            <p className="muted-small">Email changes may require confirmation.</p>
          </form>
        </div>

        <div className="card">
          <h2>Account details</h2>
          <div className="meta-list">
            <div className="meta-row"><span className="meta-label">Status</span><strong>{profile?.account_status ?? "active"}</strong></div>
            <div className="meta-row">
              <span className="meta-label">Access</span>
              <span>{roles?.length ? roles.map(({ role }) => <span className="role-chip" key={role}>{role}</span>) : <span className="role-chip">customer</span>}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Password</h2>
          <p>Use the secure reset flow if you want to change your password.</p>
          <a className="button button-quiet" href="/auth/forgot-password">Reset password</a>
        </div>
      </div>
    </section>
  );
}
