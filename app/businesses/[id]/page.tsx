import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { businessFields, isUuid, publicWebsite, type Business } from "@/lib/businesses";

export const metadata = { title: "Business profile" };
export default async function BusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.from("businesses").select(businessFields).eq("id", id).eq("status", "approved").maybeSingle();
  if (error) throw new Error("Business listing unavailable");
  if (!data) notFound();
  const business = data as Business;
  const website = publicWebsite(business.website_url);
  return <article className="content-narrow">
    <Link className="text-link" href="/businesses">← Explore businesses</Link>
    <div className="business-detail card">
      <div className="business-mark large-mark" aria-hidden="true">{business.name.slice(0, 1).toUpperCase()}</div>
      <p className="eyebrow">{business.category} <span aria-hidden="true">·</span> {business.location}</p>
      <h1 className="page-title">{business.name}</h1><p className="lead">{business.summary}</p>
      <div className="story"><h2>Meet the business</h2><p>{business.description}</p></div>
      {website && <a href={website} className="button button-primary" target="_blank" rel="noopener noreferrer nofollow ugc">Visit website or social profile <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a>}
      <p className="muted-small">You’ll connect directly with this business. HolyHub does not handle purchases or bookings.</p>
    </div>
    <p className="muted-small">Something doesn’t look right? <a className="text-link" href={`mailto:Official.holyhub@gmail.com?subject=${encodeURIComponent(`Listing query: ${business.name} (${business.id})`)}`}>Let us know</a>.</p>
  </article>;
}
