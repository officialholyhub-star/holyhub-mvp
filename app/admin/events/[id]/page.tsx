import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";
import { isUuid, publicWebsite } from "@/lib/businesses";
import { eventFields, type HolyHubEvent } from "@/lib/events";
import { EventForm } from "@/components/event-form";
import { MarketNav } from "@/components/market-nav";
import { Notices } from "@/components/notices";
import { SubmitButton } from "@/components/submit-button";
import { changeEventStatus } from "../actions";

export const metadata = { title: "Edit event" };
export default async function EditEventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; message?: string }> }) {
  const { supabase } = await requireRole("admin");
  const { id } = await params;
  if (id !== "new" && !isUuid(id)) notFound();
  const { data, error } = id === "new" ? { data: null, error: null } : await supabase.from("events").select(eventFields).eq("id", id).maybeSingle();
  if (error) throw new Error("Event unavailable");
  if (id !== "new" && !data) notFound();
  const event = data as HolyHubEvent | null, messages = await searchParams;
  const website = event && publicWebsite(event.website_url);
  return <section className="content-narrow">
    <MarketNav area="admin" /><Link className="text-link" href="/admin/events">← Manage events</Link>
    <div className="section-heading"><p className="eyebrow">{event ? `${event.status} event` : "New gathering"}</p><h1 className="page-title">{event ? "Edit your event." : "Add a public event."}</h1></div>
    <Notices error={messages.error} message={messages.message} />
    <div className="card"><EventForm key={event?.updated_at ?? "new"} event={event ?? undefined} /></div>
    {event && <aside className="card"><h2>Review & visibility</h2><p>Check the schedule and public organiser link before publishing. Archived or draft events are hidden from visitors.</p>{website && <p><a className="text-link wrap-anywhere" href={website} target="_blank" rel="noopener noreferrer nofollow">Check organiser’s page (opens in a new tab)</a></p>}<div className="button-row">{(["published", "draft", "archived"] as const).filter(decision => decision !== event.status).map(decision => <form key={decision} action={changeEventStatus}><input type="hidden" name="id" value={event.id} /><input type="hidden" name="updated_at" value={event.updated_at} /><input type="hidden" name="decision" value={decision} /><SubmitButton className={`button ${decision === "published" ? "button-primary" : "button-quiet"}`} pendingText="Updating…">{decision === "published" ? "Publish event" : decision === "archived" ? "Archive event" : "Return to draft"}</SubmitButton></form>)}</div>{event.status === "published" && <p><Link className="text-link" href={`/events/${event.id}`}>View public event →</Link></p>}</aside>}
  </section>;
}
