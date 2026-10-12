import { DraftForm, ClearDraft } from "@/components/draft-form";
import Link from "next/link";
import { getListerApplication } from "@/lib/lister-applications";
import { ApplicationCategoryField } from "@/components/application-category-field";
import { requireUser } from "@/lib/auth/require-user";
import { submitListerApplication } from "./actions";

export const dynamic = "force-dynamic";

export default async function ListerApplicationPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; edit?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const [{ data: profile }, { application, error: applicationError }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    getListerApplication(supabase, user.id),
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
        {params.message && !params.error && <ClearDraft draftKey={`hh-application-${user.id}`} />}
        {params.message && <p className="notice notice-success">{params.message}</p>}

        {applicationError ? <p className="notice notice-error" role="alert">We couldn’t load your application. Please refresh before trying again.</p> : application?.status === "approved" ? (
          <div>
            <p className="notice notice-success">Your lister application has been approved.</p>
            <ApplicationDetails application={application} />
            <Link className="button button-quiet" href="/account">Back to account</Link>
          </div>
        ) : application?.status === "pending" && params.edit !== "1" ? (
          <div>
            <p className="notice notice-info">Your lister application is under review. You can update your details while you wait.</p>
            <ApplicationDetails application={application} />
            <Link className="button button-primary" href="/lister/apply?edit=1">Edit application</Link>
            <Link className="button button-quiet" href="/account">Back to account</Link>
          </div>
        ) : (
          <DraftForm draftKey={`hh-application-${user.id}`} className="form" action={submitListerApplication}>
            {application && <><input type="hidden" name="application_id" value={application.id} /><input type="hidden" name="application_version" value={application.updated_at} /></>}
            {application?.status === "rejected" && <p className="notice notice-error"><strong>Changes requested.</strong> {application.rejection_reason ?? "Please review your details and submit again."}</p>}
            <div className="field">
              <label htmlFor="business_name">Business/brand name</label>
              <input id="business_name" name="business_name" type="text" defaultValue={application?.business_name ?? ""} maxLength={150} required />
            </div>
            <div className="field">
              <label htmlFor="contact_name">Contact name</label>
              <input id="contact_name" name="contact_name" type="text" autoComplete="name" defaultValue={application?.contact_name ?? profile?.full_name ?? ""} maxLength={100} required />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" defaultValue={application?.email ?? user.email ?? ""} maxLength={254} required />
            </div>
            <div className="field">
              <label htmlFor="website_or_social">Website or social media link (optional)</label>
              <input id="website_or_social" name="website_or_social" type="text" placeholder="Website, Instagram or social handle" defaultValue={application?.website_or_social === "Not provided" ? "" : application?.website_or_social ?? ""} maxLength={500} />
            </div>
            <div className="field">
              <label htmlFor="description">Short description of your business</label>
              <textarea id="description" name="description" defaultValue={application?.description ?? ""} maxLength={500} rows={4} required />
            </div>
            <ApplicationCategoryField draftKey={`hh-application-${user.id}`} savedCategory={application?.category_type} />
            <label className="terms-consent">
              <input type="checkbox" name="accept_lister_terms" required />
              <span>I agree to the <Link href="/lister-terms">HolyHub Lister Terms</Link> and <Link href="/privacy">Privacy Notice</Link>.</span>
            </label>
            <button className="button button-primary" type="submit">{application?.status === "pending" ? "Save changes" : application ? "Save & resubmit application" : "Submit application"}</button>
            {application?.status === "pending" && <Link className="button button-quiet" href="/lister/apply">Cancel</Link>}
          </DraftForm>
        )}
      </div>
    </section>
  );
}

function ApplicationDetails({ application }: { application: import("@/lib/lister-applications").ListerApplication }) {
  return <dl className="review-details" aria-label="Your saved application">
    <div><dt>Business/brand name</dt><dd>{application.business_name}</dd></div>
    <div><dt>Contact name</dt><dd>{application.contact_name}</dd></div>
    <div><dt>Email</dt><dd>{application.email}</dd></div>
    <div><dt>Website or social</dt><dd>{application.website_or_social || "Not provided"}</dd></div>
    <div><dt>About your business</dt><dd>{application.description}</dd></div>
    <div><dt>Product/category type</dt><dd>{application.category_type}</dd></div>
  </dl>;
}
