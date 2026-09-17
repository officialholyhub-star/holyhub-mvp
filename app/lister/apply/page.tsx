import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { submitListerApplication } from "./actions";

export const dynamic = "force-dynamic";

export default async function ListerApplicationPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const [{ data: profile }, { data: application }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase.from("lister_applications").select("status, created_at").eq("user_id", user.id).in("status", ["pending", "approved"]).maybeSingle(),
  ]);

  return (
    <section className="auth-wrap lister-application">
      <div className="card">
        <div className="card-header">
          <p className="eyebrow">Join the marketplace</p>
          <h2>Become a Lister</h2>
          <p>Tell us a little about your business. We&apos;ll review your application before lister access is approved.</p>
        </div>

        {params.error && <p className="notice notice-error">{params.error}</p>}
        {params.message && <p className="notice notice-success">{params.message}</p>}

        {application ? (
          <div>
            <p className="notice notice-info">
              {application.status === "approved" ? "Your lister application has been approved." : "Your lister application is under review."}
            </p>
            <Link className="button button-quiet" href="/account">Back to account</Link>
          </div>
        ) : (
          <form className="form" action={submitListerApplication}>
            <div className="field">
              <label htmlFor="business_name">Business/brand name</label>
              <input id="business_name" name="business_name" type="text" maxLength={150} required />
            </div>
            <div className="field">
              <label htmlFor="contact_name">Contact name</label>
              <input id="contact_name" name="contact_name" type="text" autoComplete="name" defaultValue={profile?.full_name ?? ""} maxLength={100} required />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" defaultValue={user.email ?? ""} maxLength={254} required />
            </div>
            <div className="field">
              <label htmlFor="website_or_social">Website or social media link</label>
              <input id="website_or_social" name="website_or_social" type="url" placeholder="https://" maxLength={500} required />
            </div>
            <div className="field">
              <label htmlFor="description">Short description of your business</label>
              <textarea id="description" name="description" maxLength={500} rows={4} required />
            </div>
            <div className="field">
              <label htmlFor="category_type">Product/category type</label>
              <input id="category_type" name="category_type" type="text" maxLength={100} required />
            </div>
            <button className="button button-primary" type="submit">Submit application</button>
          </form>
        )}
      </div>
    </section>
  );
}