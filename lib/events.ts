import { publicWebsite } from "./businesses.ts";

export type HolyHubEvent = {
  id: string;
  name: string;
  organiser: string;
  location: string;
  schedule: string;
  description: string;
  website_url: string;
  status: "draft" | "published" | "archived";
  created_at: string;
  updated_at: string;
};
export type EventValues = Pick<HolyHubEvent, "name" | "organiser" | "location" | "schedule" | "description" | "website_url">;
export type EventFormState = { error?: string; values?: Partial<EventValues> };
export const eventFields = "id,name,organiser,location,schedule,description,website_url,status,created_at,updated_at";

export function validateEvent(form: FormData): EventFormState & { data?: EventValues } {
  const read = (name: string) => typeof form.get(name) === "string" ? String(form.get(name)).trim() : "";
  const values: EventValues = { name: read("name"), organiser: read("organiser"), location: read("location"), schedule: read("schedule"), description: read("description"), website_url: read("website_url") };
  const fail = (error: string) => ({ error, values });
  if (values.name.length < 2 || values.name.length > 120) return fail("Use an event name between 2 and 120 characters.");
  if (values.organiser.length < 2 || values.organiser.length > 120) return fail("Add the public organiser name (2–120 characters).");
  if (values.location.length < 2 || values.location.length > 160) return fail("Add a public venue, city or Online (2–160 characters).");
  if (values.schedule.length < 5 || values.schedule.length > 180) return fail("Add the date/time or recurring schedule, including the time zone (5–180 characters).");
  if (values.description.length < 30 || values.description.length > 3000) return fail("Describe the event in 30–3,000 characters.");
  const website = publicWebsite(values.website_url);
  if (!website || website.length > 500) return fail("Add the organiser’s public event page, starting with https://.");
  return { data: { ...values, website_url: website }, values };
}
