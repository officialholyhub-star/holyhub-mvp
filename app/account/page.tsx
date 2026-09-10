import { updateEmail, updateProfile } from "./actions";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("full_name, account_status, created_at").eq("id", user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  return (
    <section>
      <p className="eyebrow">My HolyHub</p>
      <h2>Account</h2>
      <p className="lead">Your account can shop as a customer and can later gain lister access if HolyHub approves your application.</p>

      {params.error && <p className="notice notice-error">{params.error}</p>}
      {params.message && <p className="notice notice-success">{params.message}</p>}

      <div className="account-grid">
        <div className="card">
          <h2>Profile</h2>
          <form className="form" action={updateProfile}>
            <div className="field">
              <label htmlFor="full_name">Name</label>
              <input id="full_name" name="full_name" type="text" defaultValue={profile?.full_name ?? ""} maxLength={100} />
            </div>
            <button className="button button-primary" type="submit">Save profile</button>
          </form>
        </div>

        <div className="card">
          <h2>Email</h2>
          <form className="form" action={updateEmail}>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" defaultValue={user.email ?? ""} required />
            </div>
            <button className="button button-secondary" type="submit">Change email</button>
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
