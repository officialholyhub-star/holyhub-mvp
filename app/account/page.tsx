import { updateEmail, updateProfile } from "./actions";
import { requireUser } from "@/lib/auth/require-user";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const [{ data: profile }, { data: roles }, { data: listerApplication }] = await Promise.all([
    supabase.from("profiles").select("full_name, account_status, created_at").eq("id", user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("lister_applications").select("status").eq("user_id", user.id).in("status", ["pending", "approved"]).maybeSingle(),
  ]);

  const isLister = roles?.some(({ role }) => role === "lister") ?? false;

  return (
    <section className="customer-space">
      <div className="customer-welcome">
        <div className="customer-welcome-copy">
          <p className="eyebrow">Your HolyHub space</p>
          <h1>Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.</h1>
          <p className="lead">A place to find good things, from people and brands you can believe in.</p>
          <div className="button-row">
            <Link className="button button-primary" href="/marketplace">Explore Marketplace <span aria-hidden="true">→</span></Link>
          </div>
        </div>
        <div className="customer-welcome-image">
          <Image src="/images/community-lifestyle.jpg" alt="A group of friends gathered around a table" width={1200} height={1798} priority />
        </div>
      </div>

      {params.error && <p className="notice notice-error">{params.error}</p>}
      {params.message && <p className="notice notice-success">{params.message}</p>}

      <div className="account-grid customer-account-grid">
        <div className="card customer-settings-card">
          <h2>Profile</h2>
          <form className="form" action={updateProfile}>
            <div className="field">
              <label htmlFor="full_name">Name</label>
              <input id="full_name" name="full_name" type="text" defaultValue={profile?.full_name ?? ""} maxLength={100} />
            </div>
            <button className="button button-primary" type="submit">Save profile</button>
          </form>
        </div>

        <div className="card customer-settings-card">
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

        <div className="card customer-settings-card">
          <h2>Account details</h2>
          <div className="meta-list">
            <div className="meta-row"><span className="meta-label">Status</span><strong>{profile?.account_status ?? "active"}</strong></div>
            <div className="meta-row">
              <span className="meta-label">Access</span>
              <span>{roles?.length ? roles.map(({ role }) => <span className="role-chip" key={role}>{role}</span>) : <span className="role-chip">customer</span>}</span>
            </div>
          </div>
        </div>

        <div className="card customer-settings-card account-favourites-card">
          <h2>Favourites</h2>
          <p>Save products you want to come back to.</p>
          <Link className="button button-quiet" href="/account/favourites">View favourites</Link>
        </div>

        <div className="card lister-option-card">
          <h2>Lister access</h2>
          {isLister ? (
            <>
              <p>Your seller space is ready when you are.</p>
              <div className="button-row"><Link className="button button-quiet" href="/lister">Open lister space</Link></div>
            </>
          ) : listerApplication ? (
            <p>Your application is <strong>{listerApplication.status}</strong>.</p>
          ) : (
            <>
              <p>Have a brand to share?</p>
              <Link className="button button-quiet" href="/lister/apply">Apply to become a lister</Link>
            </>
          )}
        </div>

        <div className="card customer-settings-card">
          <h2>Password</h2>
          <p>Use the secure reset flow if you want to change your password.</p>
          <a className="button button-quiet" href="/auth/forgot-password">Reset password</a>
        </div>
      </div>
    </section>
  );
}
