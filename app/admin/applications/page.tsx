import { reviewListerApplication } from "./actions";
import { requireRole } from "@/lib/auth/require-user";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminApplicationsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const { supabase } = await requireRole("admin");
  const { data: applications, error } = await supabase
    .from("lister_applications")
    .select("id, user_id, business_name, contact_name, email, website_or_social, description, category_type, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (
    <section className="admin-review-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Admin workspace</p>
          <h1>Review lister applications</h1>
          <p className="lead">Approve trusted sellers quickly, or return an application with a clear next step.</p>
        </div>
        <span className="review-count" aria-label={`${applications?.length ?? 0} applications awaiting review`}>{applications?.length ?? 0} waiting</span>
      </div>
      <nav className="admin-tabs" aria-label="Admin workspace">
        <Link href="/admin">Overview</Link>
        <Link className="is-active" href="/admin/applications" aria-current="page">Lister Applications</Link>
        <Link href="/admin/products">Product Listings</Link>
        <span className="admin-tab-disabled">Refunds <span>Coming soon</span></span>
      </nav>
      {params.error && <p className="notice notice-error" role="alert">{params.error}</p>}
      {params.message && <p className="notice notice-success" role="status">{params.message}</p>}
      {error ? (
        <div className="marketplace-status marketplace-status-error"><strong>Applications could not be loaded</strong><p>Please try again.</p></div>
      ) : applications?.length ? (
        <div className="review-list">
          {applications?.map((application) => (
            <article className="review-card" key={application.id}>
              <div className="review-card-header">
                <div>
                  <p className="eyebrow">{application.category_type}</p>
                  <h2>{application.business_name}</h2>
                  <p className="muted-small">{application.contact_name} · {application.email} · Submitted {new Date(application.created_at).toLocaleDateString("en-GB")}</p>
                </div>
                <span className="status-pill status-pending">Pending</span>
              </div>
              <dl className="review-details">
                <div><dt>Website or social</dt><dd><a href={application.website_or_social} target="_blank" rel="noreferrer">{application.website_or_social}</a></dd></div>
                <div><dt>About the business</dt><dd>{application.description}</dd></div>
              </dl>
              <div className="review-actions">
                <form action={reviewListerApplication} className="review-reject-form">
                  <input type="hidden" name="application_id" value={application.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <label className="sr-only" htmlFor={`reason-${application.id}`}>Reason for requesting changes</label>
                  <input id={`reason-${application.id}`} name="rejection_reason" placeholder="Reason for changes (required to return)" maxLength={1000} required />
                  <button className="button button-secondary" type="submit">Return for changes</button>
                </form>
                <form action={reviewListerApplication}>
                  <input type="hidden" name="application_id" value={application.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <button className="button button-primary" type="submit">Approve and grant access</button>
                </form>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card empty-state"><h2>No lister applications are waiting for review.</h2><p>New applications will appear here when a brand applies.</p></div>
      )}
    </section>
  );
}