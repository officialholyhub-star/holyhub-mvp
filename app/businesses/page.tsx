import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { categories, businessFields, pageNumber, searchTerm, type Business, type Category } from "@/lib/businesses";
import { BusinessCard } from "@/components/business-card";

export const metadata = { title: "Discover Christian businesses", description: "Discover Christian-owned brands, creators and events. Find your next favourite on HolyHub." };
const PAGE_SIZE = 12;

export default async function BusinessesPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; page?: string }> }) {
  const params = await searchParams;
  const q = searchTerm(params.q);
  const category = categories.includes(params.category as Category) ? params.category as Category : "";
  const page = pageNumber(params.page);
  const supabase = await createClient();
  let query = supabase.from("businesses").select(businessFields, { count: "exact" }).eq("status", "approved");
  if (category) query = query.eq("category", category);
  if (q) query = query.or(`name.ilike.%${q}%,summary.ilike.%${q}%,location.ilike.%${q}%`);
  const { data, count, error } = await query.order("created_at", { ascending: false }).order("id").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const businesses = (data ?? []) as Business[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  function pageUrl(number: number) {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (category) search.set("category", category);
    if (number > 1) search.set("page", String(number));
    return `/businesses${search.size ? `?${search}` : ""}`;
  }
  if (!error && page > pages) redirect(pageUrl(pages));

  return <section>
    <div className="section-heading"><p className="eyebrow">Good things. Shared values.</p><h1 className="page-title">Find your next favourite.</h1><p className="lead">Discover Christian brands, businesses, creators and events worth showing up for.</p></div>
    <form action="/businesses" className="search-bar" role="search">
      <div className="field search-field"><label htmlFor="q">What are you looking for?</label><input type="search" id="q" name="q" defaultValue={q} placeholder="A brand, a service, a city…" maxLength={80} /></div>
      <div className="field"><label htmlFor="category">Category</label><select id="category" name="category" defaultValue={category}><option value="">All categories</option>{categories.map(item => <option key={item}>{item}</option>)}</select></div>
      <button className="button button-primary" type="submit">Search <span aria-hidden="true">→</span></button>
    </form>
    {error ? <div className="empty-state card" role="status"><h2>Discovery is taking a moment.</h2><p>We couldn’t load the businesses right now. Please try again shortly.</p><Link className="button button-quiet" href={pageUrl(page)}>Try again</Link></div> : <>
      <div className="results-heading"><p>{count ?? 0} {(count ?? 0) === 1 ? "business" : "businesses"}{category ? ` in ${category}` : " to discover"}</p>{(q || category) && <Link className="text-link" href="/businesses">Clear filters</Link>}</div>
      {businesses.length ? <div className="business-grid">{businesses.map(business => <BusinessCard key={business.id} business={business} />)}</div> : <div className="empty-state card"><span className="empty-mark" aria-hidden="true">✦</span><h2>{q || category ? "Nothing here just yet." : "Be part of the beginning."}</h2><p>{q || category ? "Try a different search or explore all categories." : "We’re welcoming our first businesses. Have a Christian brand, creative project or event? There’s a place for you here."}</p><Link className="button button-primary" href={q || category ? "/businesses" : "/account/business"}>{q || category ? "Explore all businesses" : "Submit your business"} <span aria-hidden="true">→</span></Link></div>}
      {pages > 1 && <nav className="pagination" aria-label="Business pages">{page > 1 ? <Link href={pageUrl(page - 1)} className="button button-quiet">← Previous</Link> : <span />}<span>Page {page} of {pages}</span>{page < pages ? <Link href={pageUrl(page + 1)} className="button button-quiet">Next →</Link> : <span />}</nav>}
    </>}
    <aside className="listing-invite"><div><h2>Your business belongs here.</h2><p>Tell your story. Find your people.</p></div><Link className="button button-secondary" href="/account/business">Become a Lister <span aria-hidden="true">→</span></Link></aside>
  </section>;
}
