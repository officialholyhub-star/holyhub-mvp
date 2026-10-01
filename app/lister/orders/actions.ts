"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";
import { isCarrier, isFulfilmentStatus } from "@/lib/fulfilment";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function errorMessage(message: string) {
  return `/lister/orders?error=${encodeURIComponent(message)}`;
}

function validUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function updateSellerFulfilment(formData: FormData) {
  const { supabase, user } = await requireRole("lister");
  const sellerOrderId = clean(formData.get("seller_order_id"));
  const status = clean(formData.get("fulfilment_status"));
  const carrier = clean(formData.get("carrier"));
  const carrierOther = clean(formData.get("carrier_other"));
  const trackingNumber = clean(formData.get("tracking_number"));
  const trackingUrl = clean(formData.get("tracking_url"));
  const fulfilmentNote = clean(formData.get("fulfilment_note"));

  if (!sellerOrderId || !isFulfilmentStatus(status) || (carrier && !isCarrier(carrier)) || (carrier === "Other" && !carrierOther) || carrierOther.length > 100 || trackingNumber.length > 150 || trackingUrl.length > 500 || !validUrl(trackingUrl) || fulfilmentNote.length > 1000) {
    redirect(errorMessage("Complete the fulfilment fields with valid values."));
  }

  const { data: existing, error: lookupError } = await supabase
    .from("seller_orders")
    .select("id, dispatched_at")
    .eq("id", sellerOrderId)
    .eq("seller_user_id", user.id)
    .maybeSingle();
  if (lookupError || !existing) redirect(errorMessage("That seller order could not be found."));

  const dispatchedAt = status === "dispatched" ? existing.dispatched_at ?? new Date().toISOString() : existing.dispatched_at;
  const deliveredAt = status === "delivered" ? new Date().toISOString() : null;
  const { error } = await supabase
    .from("seller_orders")
    .update({
      fulfilment_status: status,
      carrier: carrier || null,
      carrier_other: carrier === "Other" ? carrierOther : null,
      tracking_number: trackingNumber || null,
      tracking_url: trackingUrl || null,
      dispatched_at: dispatchedAt,
      delivered_at: deliveredAt,
      fulfilment_note: fulfilmentNote || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sellerOrderId)
    .eq("seller_user_id", user.id);

  if (error) redirect(errorMessage("We could not update that fulfilment record."));
  revalidatePath("/lister/orders");
  revalidatePath("/account/orders");
  redirect("/lister/orders?message=Fulfilment%20updated.");
}
