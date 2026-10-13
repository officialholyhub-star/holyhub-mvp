import { readAllRows } from "@/lib/read-all-rows";
import { DraftForm, ClearDraft } from "@/components/draft-form";
import { reviewListerApplication } from "./actions";
import { requireRole } from "@/lib/auth/require-user";
import Link from "next/link";
import { AccountListerBrand } from "@/components/account-lister-brand";
import { SUGGESTED_CATEGORY_PREFIX } from "@/lib/application-categories";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function AdminApplicationsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; reviewed?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireRole("admin");
  const { data: applications, error } = await readAllRows(offset => supabase
    .from("lister_applications")
    .select("id, user_id, business_name, contact_name, email, website_or_social, description, category_type, status, created_at, updated_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true }).order("id").range(offset, offset + 999));

  const applicantIds = [...new Set(applications?.map((application) => application.user_id) ?? [])];
  const { data: storefronts, error: logoError } = applicantIds.length
    ? await supabase.from("lister_storefronts").select("user_id, logo_url").in("user_id", applicantIds)
    : { data: [], error: null };
  const logos = new Map(storefronts?.map((storefront) => [storefront.user_id, storefront.logo_url]));

  return (
    <section className="admin-review-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Admin workspace</p>
          <h1>Review lister applications</h1>
          <p className="lead">Approve trusted sellers quickly, or return an application with a clear next step.</p>
        </div>
        <span className="review-count">{error ? "Count unavailable" : `${applications?.length ?? 0} waiting`}</span>
      </div>
      <nav className="admin-tabs" aria-label="Admin workspace"><a href="/admin/orders">Orders</a>
        <Link href="/admin">Overview</Link>
        <Link className="is-active" href="/admin/applications" aria-current="page">Lister Applications</Link>
        <Link href="/admin/listers">Listers</Link>
        <Link href="/admin/products">Product Listings</Link>
        <span className="admin-tab-disabled">Refunds <span>Coming soon</span></span>
      </nav>
      {params.error && <p className="notice notice-error" role="alert">{params.error}</p>}
      {params.reviewed && <ClearDraft draftKey={`hh-review-application-${user.id}-${params.reviewed}`} />}
      {params.message && <p className="notice notice-success" role="status">{params.message}</p>}
      {logoError && <p className="notice notice-error" role="alert">Brand logos could not be loaded. Please refresh to try again.</p>}
      {error ? (
        <div className="marketplace-status marketplace-status-error"><strong>Applications could not be loaded</strong><p>Please try again.</p></div>
      ) : applications?.length ? (
        <div className="review-list">
          {applications?.map((application) => (
            <article className="review-card" key={application.id}>
              <div className="review-card-header">
                <div className={styles.brandHeading}>
                  <AccountListerBrand businessName={application.business_name} logoUrl={logos.get(application.user_id) ?? null} />
                  <div className={styles.brandDetails}>
                    <h2>{application.business_name}</h2>
                    <p className="muted-small">{application.contact_name} · {application.email} · Submitted {new Date(application.created_at).toLocaleDateString("en-GB")}</p>
                  </div>
                </div>
                <span className="status-pill status-pending">Awaiting your review</span>
              </div>
              <dl className="review-details">
                <div><dt>Selected category:</dt><dd>{application.category_type.startsWith(SUGGESTED_CATEGORY_PREFIX) ? "Other" : application.category_type}</dd></div>
                {application.category_type.startsWith(SUGGESTED_CATEGORY_PREFIX) && <div><dt>Suggested category:</dt><dd className={styles.suggestedCategory}>{application.category_type.slice(SUGGESTED_CATEGORY_PREFIX.length)}</dd></div>}
                <div><dt>Website or social</dt><dd>{application.website_or_social === "Not provided" ? "Not provided" : <a href={application.website_or_social} target="_blank" rel="noreferrer">{application.website_or_social}</a>}</dd></div>
                <div><dt>About the business</dt><dd>{application.description}</dd></div>
              </dl>
              <div className="review-actions">
                <DraftForm draftKey={`hh-review-application-${user.id}-${application.id}`} action={reviewListerApplication} className="review-reject-form">
                  <input type="hidden" name="application_id" value={application.id} />
                  <input type="hidden" name="application_version" value={application.updated_at} />
                  <input type="hidden" name="decision" value="reject" />
                  <label className="sr-only" htmlFor={`reason-${application.id}`}>Reason for requesting changes</label>
                  <input id={`reason-${application.id}`} name="rejection_reason" placeholder="Reason for changes (required to return)" maxLength={1000} required />
                  <button className="button button-secondary" type="submit">Return for changes</button>
                </DraftForm>
                <form action={reviewListerApplication}>
                  <input type="hidden" name="application_id" value={application.id} />
                  <input type="hidden" name="application_version" value={application.updated_at} />
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
