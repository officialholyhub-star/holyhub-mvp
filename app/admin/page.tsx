import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { businessFields, pageNumber, publicWebsite, type Business } from "@/lib/businesses";
import { SubmitButton } from "@/components/submit-button";
import { reviewBusiness } from "./actions";
import { MarketNav } from "@/components/market-nav";

export const metadata = { title: "Review businesses" };
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; error?: string; message?: string }> }) {
  const { supabase } = await requireRole("admin");
  const params = await searchParams;
  const status = params.status === "approved" || params.status === "rejected" ? params.status : "pending";
  const page = pageNumber(params.page);
  const { data, count, error } = await supabase.from("businesses").select(businessFields, { count: "exact" }).eq("status", status).order("created_at").order("id").range((page - 1) * 10, page * 10 - 1);
  if (error) throw new Error("Review queue unavailable");
  return <section className="content-narrow">
    <MarketNav area="admin" />
    <Link href="/account" className="text-link">← My account</Link>
    <div className="section-heading"><p className="eyebrow">HolyHub review</p><h1 className="page-title">Make room for good things.</h1><p>Check each business and its public link before publishing. Owners confirm they represent a Christian-owned or faith-led business when submitting.</p></div>
    {params.error && <p className="notice notice-error" role="alert">{params.error}</p>}{params.message && <p className="notice notice-success" role="status">{params.message}</p>}
    <nav className="filter-tabs" aria-label="Listing review status">{["pending", "approved", "rejected"].map(item => <Link key={item} href={`/admin?status=${item}`} aria-current={item === status ? "page" : undefined}>{item === "pending" ? "In review" : item === "approved" ? "Published" : "Not approved"}</Link>)}</nav>
    <p>{count ?? 0} {status} {(count ?? 0) === 1 ? "listing" : "listings"}</p>
    <div className="review-list">{(data as Business[]).map(business => {
      const website = publicWebsite(business.website_url);
      return <article className="card" key={business.id}>
        <p className="eyebrow">{business.category} · {business.location}</p><h2>{business.name}</h2><p>{business.summary}</p><p className="preserve-lines">{business.description}</p>
        {website && <a href={website} className="text-link wrap-anywhere" target="_blank" rel="noopener noreferrer nofollow">{website}<span className="sr-only"> (opens in a new tab)</span></a>}
        <div className="button-row">{["approved", "rejected"].filter(decision => decision !== status).map(decision => <form key={decision} action={reviewBusiness}><input type="hidden" name="id" value={business.id} /><input type="hidden" name="updated_at" value={business.updated_at} /><input type="hidden" name="decision" value={decision} /><SubmitButton className={`button ${decision === "approved" ? "button-primary" : "button-quiet"}`} pendingText="Saving…">{decision === "approved" ? "Approve & publish" : status === "approved" ? "Unpublish" : "Do not approve"}</SubmitButton></form>)}</div>
      </article>;
    })}</div>
    {!data.length && <div className="empty-state card"><h2>All clear here.</h2><p>No listings on this page.</p></div>}
    <nav className="pagination" aria-label="Review pages">{page > 1 ? <Link className="button button-quiet" href={`/admin?status=${status}&page=${page - 1}`}>← Previous</Link> : <span />}<span>Page {page}</span>{page * 10 < (count ?? 0) && <Link className="button button-quiet" href={`/admin?status=${status}&page=${page + 1}`}>Next →</Link>}</nav>
  </section>;
}
