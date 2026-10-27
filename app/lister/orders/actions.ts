"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";
import { validCancellationReason } from "@/lib/order-cancellation";
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
  const intent = clean(formData.get("intent")) || "status";
  const carrier = clean(formData.get("carrier"));
  const carrierOther = clean(formData.get("carrier_other"));
  const trackingNumber = clean(formData.get("tracking_number"));
  const trackingUrl = clean(formData.get("tracking_url"));
  const fulfilmentNote = clean(formData.get("fulfilment_note"));

  const writesDelivery = intent === "delivery" || (intent === "status" && status === "dispatched");
  if (!sellerOrderId || !isFulfilmentStatus(status) || (writesDelivery && ((carrier && !isCarrier(carrier)) || (carrier === "Other" && !carrierOther) || carrierOther.length > 100 || trackingNumber.length > 150 || trackingUrl.length > 500 || !validUrl(trackingUrl))) || (intent === "note" && fulfilmentNote.length > 1000)) {
    redirect(errorMessage("Complete the order fields with valid values."));
  }

  const { data: existing, error: lookupError } = await supabase
    .from("seller_orders")
    .select("id, fulfilment_status, dispatched_at, delivered_at")
    .eq("id", sellerOrderId)
    .eq("seller_user_id", user.id)
    .maybeSingle();
  if (lookupError || !existing) redirect(errorMessage("That seller order could not be found."));

  if (!["status", "delivery", "note", "correction"].includes(intent)) redirect(errorMessage("Choose a valid order action."));
  if ((intent === "status" || intent === "correction") && status === "cancelled" && !["pending", "packed"].includes(existing.fulfilment_status)) {
    redirect(errorMessage("Orders already sent cannot be cancelled here."));
  }
  if ((intent === "status" || intent === "correction") && ["dispatched", "delivered", "cancelled"].includes(status) && clean(formData.get("confirmed")) !== "yes") redirect(errorMessage("Confirm this order status change first."));
  if (intent === "status" && status === "cancelled") {
    if (!validCancellationReason(clean(formData.get("cancellation_reason")), clean(formData.get("cancellation_custom_reason")))) redirect(errorMessage("Choose a cancellation reason. Other needs a short explanation."));
    if (clean(formData.get("cancellation_confirmation")) !== "final") redirect(errorMessage("Complete both cancellation confirmations first."));
    // The guarded cancellation RPC stores the reason with the refund operation.
  }
  if (intent === "status") {
    const next = existing.fulfilment_status === "pending" ? ["packed", "cancelled"] : existing.fulfilment_status === "packed" ? ["dispatched", "cancelled"] : existing.fulfilment_status === "dispatched" ? ["delivered"] : [];
    if (!next.includes(status)) redirect(errorMessage("Use Correct order status to change an earlier stage."));
  }
  if (intent === "correction") {
    const previous = existing.fulfilment_status === "packed" ? ["pending"] : existing.fulfilment_status === "dispatched" ? ["pending", "packed"] : existing.fulfilment_status === "delivered" ? ["pending", "packed", "dispatched"] : [];
    if (!previous.includes(status) || clean(formData.get("confirmed")) !== "yes") redirect(errorMessage("Choose an earlier stage to correct this order."));
  }
  const statusChange = intent === "status" || intent === "correction";
  const expectedStatus = clean(formData.get("expected_status"));
  if (statusChange && expectedStatus && expectedStatus !== existing.fulfilment_status) redirect(errorMessage("This order has changed. Refresh before updating it."));
  if (intent === "status" && status === "cancelled") {
    const reason = clean(formData.get("cancellation_reason"));
    const explanation = clean(formData.get("cancellation_custom_reason"));
    const { error } = await supabase.rpc("cancel_seller_order_with_refund", {
      p_seller_order_id: sellerOrderId,
      p_expected_status: existing.fulfilment_status,
      p_reason: explanation ? `${reason}: ${explanation}` : reason,
    });
    if (error) redirect(errorMessage("Cancellation could not be recorded. Ask HolyHub to review any existing refund."));
    revalidatePath("/lister/orders");
    revalidatePath("/lister");
    revalidatePath("/account/orders");
    redirect("/lister/orders?message=Cancellation%20recorded.%20Refund%20queued%20for%20processing.");
  }
  const metadata = { carrier: carrier || null, carrier_other: carrier === "Other" ? carrierOther : null, tracking_number: trackingNumber || null, tracking_url: trackingUrl || null };
  const dispatchedAt = status === "dispatched" ? existing.dispatched_at ?? new Date().toISOString() : existing.dispatched_at;
  const deliveredAt = status === "delivered" ? existing.delivered_at ?? new Date().toISOString() : null;
  const statusDates = intent === "correction" ? {
    dispatched_at: status === "dispatched" ? existing.dispatched_at : null,
    delivered_at: null,
  } : { dispatched_at: dispatchedAt, delivered_at: deliveredAt };
  const values = intent === "delivery" ? metadata : intent === "note" ? { fulfilment_note: fulfilmentNote || null } : {
    fulfilment_status: status, ...statusDates,
    ...(intent === "status" && status === "dispatched" ? metadata : {}),
  };
  const update = supabase
    .from("seller_orders")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", sellerOrderId)
    .eq("seller_user_id", user.id);

  if (statusChange) update.eq("fulfilment_status", existing.fulfilment_status);
  const { data: saved, error } = await update.select("id").maybeSingle();
  if (!error && !saved) redirect(errorMessage("This order has changed. Refresh before updating it."));
  if (error) redirect(errorMessage("We could not update that fulfilment record."));
  revalidatePath("/lister/orders");
  revalidatePath("/lister");
  revalidatePath("/account/orders");
  redirect(`/lister/orders?message=Fulfilment%20updated.${intent === "delivery" || intent === "note" || (intent === "status" && status === "dispatched") ? `&saved_edits=${encodeURIComponent(sellerOrderId)}` : ""}`);
}
