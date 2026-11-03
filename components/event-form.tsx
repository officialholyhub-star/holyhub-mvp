"use client";

import { useActionState } from "react";
import { saveEvent } from "@/app/admin/events/actions";
import { type HolyHubEvent, type EventFormState } from "@/lib/events";
import { SubmitButton } from "@/components/submit-button";

export function EventForm({ event }: { event?: HolyHubEvent }) {
  const initial: EventFormState = { values: event ?? {} };
  const [state, action] = useActionState(saveEvent, initial);
  const values = state.values ?? initial.values;
  return <form action={action} className="form">
    {state.error && <p className="notice notice-error" role="alert">{state.error}</p>}
    {event && <><input type="hidden" name="id" value={event.id} /><input type="hidden" name="updated_at" value={event.updated_at} /></>}
    <div className="field"><label htmlFor="name">Event name</label><input id="name" name="name" defaultValue={values?.name} minLength={2} maxLength={120} required /></div>
    <div className="form-columns">
      <div className="field"><label htmlFor="organiser">Organiser</label><input id="organiser" name="organiser" defaultValue={values?.organiser} minLength={2} maxLength={120} required /></div>
      <div className="field"><label htmlFor="location">Location</label><input id="location" name="location" defaultValue={values?.location} minLength={2} maxLength={160} placeholder="Public venue and city, or Online" required /></div>
    </div>
    <div className="field"><label htmlFor="schedule">Dates & recurring schedule</label><input id="schedule" name="schedule" defaultValue={values?.schedule} minLength={5} maxLength={180} placeholder="e.g. Every first Friday, 7–9pm UK time" aria-describedby="schedule-help" required /><span id="schedule-help" className="muted-small">Include the time zone and any end date. This is a directory, not an automatic recurrence or ticketing system.</span></div>
    <div className="field"><label htmlFor="description">About the event</label><textarea id="description" name="description" rows={5} defaultValue={values?.description} minLength={30} maxLength={3000} required /></div>
    <div className="field"><label htmlFor="website_url">Organiser’s event link</label><input id="website_url" name="website_url" type="url" defaultValue={values?.website_url} placeholder="https://" maxLength={500} required /></div>
    <p className="muted-small">Use verified, public event information only. Saving returns the event to draft; publish separately after reviewing it. Archive cancelled or outdated events.</p>
    <SubmitButton pendingText="Saving…">Save event draft</SubmitButton>
  </form>;
}
