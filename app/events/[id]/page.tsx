import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid, publicWebsite } from "@/lib/businesses";
import { eventFields, type HolyHubEvent } from "@/lib/events";

export const metadata = { title: "Event details" };
export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select(eventFields).eq("id", id).eq("status", "published").maybeSingle();
  if (error) throw new Error("Event unavailable");
  if (!data) notFound();
  const event = data as HolyHubEvent;
  const website = publicWebsite(event.website_url);
  return <section className="content-narrow">
    <Link className="text-link" href="/events">← All events</Link>
    <div className="section-heading"><p className="eyebrow">{event.location}</p><h1 className="page-title">{event.name}</h1><p className="lead">{event.schedule}</p></div>
    <article className="card"><h2>About this gathering</h2><p>Organised by <strong>{event.organiser}</strong></p><p className="preserve-lines">{event.description}</p>{website && <a className="button button-primary" href={website} target="_blank" rel="noopener noreferrer nofollow">Visit the organiser <span aria-hidden="true">→</span><span className="sr-only"> (opens in a new tab)</span></a>}<p className="muted-small">Check the organiser’s page for the latest dates, access information, cancellations and any booking requirements. Booking happens with the organiser, not HolyHub.</p></article>
  </section>;
}
