import { DraftForm, ClearDraft } from "@/components/draft-form";
import { updateEmail, updateProfile } from "./actions";
import { requireUser } from "@/lib/auth/require-user";
import { AccountListerBrand } from "@/components/account-lister-brand";
import Link from "next/link";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const [{ data: profile, error: profileError }, { data: roles, error: rolesError }, { data: listerApplication, error: applicationError }] = await Promise.all([
    supabase.from("profiles").select("full_name, account_status, created_at").eq("id", user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("lister_applications").select("status").eq("user_id", user.id).in("status", ["pending", "approved"]).maybeSingle(),
  ]);

  const isLister = roles?.some(({ role }) => role === "lister") ?? false;
  const { data: storefront, error: storefrontError } = isLister
    ? await supabase.from("lister_storefronts").select("business_name, logo_url").eq("user_id", user.id).maybeSingle()
    : { data: null, error: null };
  const firstName = profile?.full_name?.trim().split(/\s+/)[0];
  const access = rolesError ? "Unavailable" : roles?.length ? roles.map(({ role }) => role.charAt(0).toUpperCase() + role.slice(1)).join(" / ") : "Customer";
  const accountStatus = profileError ? "unavailable" : profile?.account_status ?? "active";

  return (
    <section className={`customer-space ${styles.page}`}>
      <header className={styles.welcome}>
          <p className="eyebrow">Your HolyHub space</p>
          <h1>Welcome back{firstName ? `, ${firstName}` : ""}.</h1>
          <p className="lead">A place to find good things, from people and brands you can believe in.</p>
      </header>

      {(profileError || rolesError || applicationError || storefrontError) && <p className="notice notice-error" role="alert">Some account details could not be loaded. Refresh before editing your profile or checking access.</p>}
      {params.message === "Storefront saved." && <ClearDraft draftKey={`hh-shop-draft-${user.id}`} />}
      {params.message === "Profile updated." && <ClearDraft draftKey={`hh-account-profile-${user.id}`} />}
      {params.message === "Check your email to confirm the change." && <ClearDraft draftKey={`hh-account-email-${user.id}`} />}
      {params.error && <p className="notice notice-error">{params.error}</p>}
      {params.message && <p className="notice notice-success">{params.message}</p>}

      {isLister && (
        <Link className={styles.listerShortcut} href="/lister">
          {storefront && <AccountListerBrand businessName={storefront.business_name} logoUrl={storefront.logo_url} />}
          <div className={styles.listerCopy}>
            <p className="eyebrow">Lister access</p>
            <h2>Your lister space is ready.</h2>
            <span className={styles.listerCta}>Open lister space <span aria-hidden="true">→</span></span>
          </div>
          <span className={styles.listerArrow} aria-hidden="true">→</span>
        </Link>
      )}

      <section className={styles.application} aria-labelledby="personalise-heading">
        <h2 id="personalise-heading">Personalise HolyHub</h2>
        <p>Update what you’re interested in and finish your HolyHub setup.</p>
        <Link className="button button-secondary" href="/account/setup?edit=1">Edit preferences</Link>
      </section>

      <nav className={styles.actions} aria-label="Your account">
        <Link className={`${styles.action} ${styles.orders}`} href="/account/orders">
          <div><p className="eyebrow">Purchases &amp; delivery</p><h2>My orders</h2><p>Track your orders and delivery updates.</p><span className={styles.actionLabel}>View my orders</span></div>
          <span className={styles.actionArrow} aria-hidden="true">→</span>
        </Link>
        <Link className={styles.action} href="/account/favourites">
          <div><h2>Favourites</h2><p>Save products you want to come back to.</p><span className={styles.actionLabel}>View favourites</span></div>
          <span className={styles.actionArrow} aria-hidden="true">→</span>
        </Link>
      </nav>

      {!rolesError && !applicationError && !isLister && (
        <section className={styles.application} aria-labelledby="lister-access-heading">
          <p className="eyebrow">Lister access</p>
          {listerApplication ? (
            <><h2 id="lister-access-heading">Lister access</h2><p>{listerApplication.status === "approved" ? "Your lister application has been approved. Lister access is still being activated." : "Your lister application is pending."}</p></>
          ) : (
            <><h2 id="lister-access-heading">Have a brand to share?</h2><Link className="text-link" href="/lister/apply">Apply to become a lister <span aria-hidden="true">→</span></Link></>
          )}
        </section>
      )}

      <section className={styles.settings} aria-labelledby="account-settings-heading">
        <div className={styles.settingsHeading}>
          <h2 id="account-settings-heading">Account settings</h2>
          <p>Keep your personal details up to date.</p>
        </div>
        <div className={styles.settingsGrid}>
        <section className={styles.settingsForm} aria-labelledby="profile-heading">
          <h3 id="profile-heading">Profile</h3>
          <DraftForm draftKey={`hh-account-profile-${user.id}`} className="form" action={updateProfile}>
            <div className="field">
              <label htmlFor="full_name">Name</label>
              <input id="full_name" name="full_name" type="text" defaultValue={profile?.full_name ?? ""} maxLength={100} />
            </div>
            <button className="button button-primary" type="submit" disabled={Boolean(profileError)}>Save profile</button>
          </DraftForm>
        </section>

        <section className={styles.settingsForm} aria-labelledby="email-heading">
          <h3 id="email-heading">Email</h3>
          <DraftForm draftKey={`hh-account-email-${user.id}`} className="form" action={updateEmail}>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" defaultValue={user.email ?? ""} required />
            </div>
            <button className="button button-quiet" type="submit">Change email</button>
            <p className="muted-small">Email changes may require confirmation.</p>
          </DraftForm>
        </section>

        <section className={styles.settingsForm} aria-labelledby="details-heading">
          <h3 id="details-heading">Account details</h3>
          <dl className={styles.summary} aria-label="Account details">
            <div><dt>Status</dt><dd>{accountStatus.charAt(0).toUpperCase() + accountStatus.slice(1)}</dd></div>
            <div><dt>Access</dt><dd>{access}</dd></div>
          </dl>
        </section>

        <section className={styles.settingsForm} aria-labelledby="password-heading">
          <h3 id="password-heading">Password</h3>
          <p>Change your password securely.</p>
          <Link className="button button-quiet" href="/auth/forgot-password">Reset password</Link>
        </section>
        </div>
        <section className={styles.management} aria-labelledby="account-management-heading"><h3 id="account-management-heading">Account management</h3><p>Permanently close your HolyHub account. Personal account data will be deleted where possible; some records must be retained for order, payment or legal requirements. Deletion cannot be undone.</p><Link className="button button-secondary" href="/account/delete">Delete account</Link><p className="muted-small">Account closure is currently arranged by email. Your account stays active until deletion is completed.</p></section>
      </section>
    </section>
  );
}