import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pageNumber, searchTerm } from "@/lib/businesses";
import { eventFields, type HolyHubEvent } from "@/lib/events";

export const metadata = { title: "Christian events", description: "Discover public Christian events and recurring gatherings. Check dates and booking with the organiser." };
const PAGE_SIZE = 12;

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams;
  const q = searchTerm(params.q), page = pageNumber(params.page);
  const supabase = await createClient();
  let query = supabase.from("events").select(eventFields, { count: "exact" }).eq("status", "published");
  if (q) query = query.or(`name.ilike.%${q}%,organiser.ilike.%${q}%,location.ilike.%${q}%`);
  const { data, count, error } = await query.order("name").order("id").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const pageUrl = (number: number) => `/events?${new URLSearchParams({ ...(q ? { q } : {}), page: String(number) })}`;
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  if (!error && page > pages) redirect(pageUrl(pages));
  return <section>
    <div className="section-heading"><p className="eyebrow">Faith. Friendship. Good company.</p><h1 className="page-title">Find your next gathering.</h1><p className="lead">Public Christian events and recurring gatherings, all in one place.</p></div>
    <form action="/events" className="search-bar" role="search"><div className="field search-field"><label htmlFor="q">Search events</label><input id="q" name="q" type="search" defaultValue={q} placeholder="An event, organiser or city…" maxLength={80} /></div><button type="submit" className="button button-primary">Find events <span aria-hidden="true">→</span></button></form>
    {error ? <div className="empty-state card" role="status"><h2>Events are taking a moment.</h2><p>We couldn’t load the directory. Please try again shortly.</p><Link className="button button-quiet" href={pageUrl(page)}>Try again</Link></div> : <>
      <div className="results-heading"><p>{count ?? 0} {(count ?? 0) === 1 ? "event" : "events"} to discover</p>{q && <Link className="text-link" href="/events">Clear search</Link>}</div>
      {data?.length ? <div className="business-grid">{(data as HolyHubEvent[]).map(event => <article className="business-card" key={event.id}><div className="business-card-body"><span className="category-chip">{event.location}</span><h2><Link href={`/events/${event.id}`}>{event.name}</Link></h2><p>{event.schedule}</p><div className="business-card-footer"><span>{event.organiser}</span><Link href={`/events/${event.id}`} aria-label={`Details for ${event.name}`}>Details <span aria-hidden="true">→</span></Link></div></div></article>)}</div> : <div className="empty-state card"><h2>{q ? "No matching events just yet." : "Good gatherings are on their way."}</h2><p>{q ? "Try another name or city, or explore all events." : "Our team is preparing the first public events. There are no events listed yet."}</p>{q && <Link className="button button-quiet" href="/events">Explore all events</Link>}</div>}
      {pages > 1 && <nav className="pagination" aria-label="Event pages">{page > 1 ? <Link className="button button-quiet" href={pageUrl(page - 1)}>← Previous</Link> : <span />}<span>Page {page} of {pages}</span>{page < pages ? <Link className="button button-quiet" href={pageUrl(page + 1)}>Next →</Link> : <span />}</nav>}
    </>}
    <p className="muted-small">Please confirm the latest dates, accessibility, availability and booking details with the organiser. HolyHub does not sell event tickets.</p>
  </section>;
}
