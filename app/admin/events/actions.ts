"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";
import { isUuid } from "@/lib/businesses";
import { validateEvent, type EventFormState } from "@/lib/events";

function refreshEvents() {
  revalidatePath("/events", "layout");
  revalidatePath("/admin/events", "layout");
}

export async function saveEvent(_previous: EventFormState, form: FormData): Promise<EventFormState> {
  const { supabase } = await requireRole("admin");
  const result = validateEvent(form);
  if (!result.data) return result;
  const id = form.get("id");
  const updated = form.get("updated_at");
  if (id && (!isUuid(id) || typeof updated !== "string" || !Number.isFinite(Date.parse(updated)))) {
    return { error: "Reload the event before saving.", values: result.values };
  }
  const { data, error } = await supabase.rpc("save_event", { payload: { ...result.data, ...(id ? { id, expected_updated_at: updated } : {}) } });
  if (error || !isUuid(data)) return { error: error?.code === "40001" ? "This event changed in another window. Reload before saving; your edits have not been applied." : "We couldn’t save the event. Your details are still here; please try again.", values: result.values };
  refreshEvents();
  redirect(`/admin/events/${data}?message=Draft%20saved.%20Review%20the%20details%20before%20publishing.`);
}

export async function changeEventStatus(form: FormData) {
  const { supabase } = await requireRole("admin");
  const id = form.get("id"), decision = form.get("decision"), updated = form.get("updated_at");
  if (!isUuid(id) || !["draft", "published", "archived"].includes(String(decision)) || typeof updated !== "string" || !Number.isFinite(Date.parse(updated))) redirect("/admin/events?error=Invalid%20event%20change.");
  const { data, error } = await supabase.rpc("set_event_status", { event_id: id, decision, expected_updated_at: updated });
  if (error || !data) redirect(`/admin/events/${id}?error=The%20event%20changed%20or%20could%20not%20be%20updated.%20Reload%20and%20try%20again.`);
  refreshEvents();
  redirect(`/admin/events/${id}?message=${encodeURIComponent(decision === "published" ? "Event published." : decision === "archived" ? "Event archived and hidden from discovery." : "Event unpublished.")}`);
}
