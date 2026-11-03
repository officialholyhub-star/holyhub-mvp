import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { pageNumber } from "@/lib/businesses";
import { eventFields, type HolyHubEvent } from "@/lib/events";
import { MarketNav } from "@/components/market-nav";
import { Notices } from "@/components/notices";

export const metadata = { title: "Manage events" };
export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; error?: string; message?: string }> }) {
  const { supabase } = await requireRole("admin");
  const params = await searchParams;
  const status = params.status === "published" || params.status === "archived" ? params.status : "draft";
  const page = pageNumber(params.page);
  const { data, count, error } = await supabase.from("events").select(eventFields, { count: "exact" }).eq("status", status).order("updated_at", { ascending: false }).order("id").range((page - 1) * 12, page * 12 - 1);
  if (error) throw new Error("Event administration unavailable");
  return <section className="content-narrow">
    <MarketNav area="admin" />
    <div className="section-heading"><p className="eyebrow">HolyHub events</p><h1 className="page-title">Make space for community.</h1><p>Curate verified public Christian events. Save a draft, check the organiser’s details, then publish.</p><Link className="button button-primary" href="/admin/events/new">Add an event →</Link></div>
    <Notices error={params.error} message={params.message} />
    <nav className="filter-tabs" aria-label="Event status">{["draft", "published", "archived"].map(item => <Link key={item} href={`/admin/events?status=${item}`} aria-current={status === item ? "page" : undefined}>{item === "draft" ? "Drafts" : item === "published" ? "Published" : "Archived"}</Link>)}</nav>
    <p>{count ?? 0} {status} {(count ?? 0) === 1 ? "event" : "events"}</p>
    <div className="review-list">{(data as HolyHubEvent[]).map(event => <article className="card" key={event.id}><p className="eyebrow">{event.location}</p><h2>{event.name}</h2><p>{event.schedule}</p><p>{event.organiser}</p><Link className="button button-quiet" href={`/admin/events/${event.id}`}>Edit event →</Link></article>)}</div>
    {!data.length && <div className="empty-state card"><h2>No {status} events here.</h2><p>Add a verified event to begin.</p></div>}
    <nav className="pagination" aria-label="Admin event pages">{page > 1 ? <Link className="button button-quiet" href={`/admin/events?status=${status}&page=${page - 1}`}>← Previous</Link> : <span />}<span>Page {page}</span>{page * 12 < (count ?? 0) && <Link className="button button-quiet" href={`/admin/events?status=${status}&page=${page + 1}`}>Next →</Link>}</nav>
  </section>;
}
