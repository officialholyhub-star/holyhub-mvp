/** STAGED ONLY: no application imports this file until the approved patch lands. */
export const DISPATCH_SHOP_FIELDS = "dispatch_min_working_days, dispatch_max_working_days, dispatch_made_to_order, transit_min_working_days, transit_max_working_days";
export type DispatchSettings = {
  dispatch_min_working_days?: number | null;
  dispatch_max_working_days?: number | null;
  dispatch_made_to_order?: boolean | null;
  transit_min_working_days?: number | null;
  transit_max_working_days?: number | null;
};
function validRange(min: unknown, max: unknown): min is number {
  return typeof min === "number" && typeof max === "number" && Number.isInteger(min)
    && Number.isInteger(max) && min >= 1 && max >= min && max <= 365;
}
export function snapshotDispatchPromise(settings: DispatchSettings, capturedAt: string) {
  if (!validRange(settings.dispatch_min_working_days, settings.dispatch_max_working_days)
    || typeof settings.dispatch_made_to_order !== "boolean"
    || !Number.isFinite(Date.parse(capturedAt))) return null;
  const transitMin = settings.transit_min_working_days ?? null;
  const transitMax = settings.transit_max_working_days ?? null;
  if (!((transitMin === null && transitMax === null) || validRange(transitMin, transitMax))) return null;
  return {
    dispatch_promise_version: 1,
    dispatch_min_working_days: settings.dispatch_min_working_days,
    dispatch_max_working_days: settings.dispatch_max_working_days!,
    dispatch_made_to_order: settings.dispatch_made_to_order,
    transit_min_working_days: transitMin,
    transit_max_working_days: transitMax,
    dispatch_promise_captured_at: new Date(capturedAt).toISOString(),
  };
}
export type DispatchConfirmation = {
  eventId: string;
  eventType: string;
  eventCreated: number;
  sessionId: string;
  paymentStatus: string;
  orderId: string;
};
export function dispatchConfirmationArguments(input: DispatchConfirmation) {
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(input.eventType)
    || input.paymentStatus !== "paid" || !/^evt_[A-Za-z0-9]+$/.test(input.eventId)
    || !Number.isSafeInteger(input.eventCreated) || input.eventCreated <= 0
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.orderId)
    || !input.sessionId.startsWith("cs_")) return null;
  const date = new Date(input.eventCreated * 1000);
  if (!Number.isFinite(date.getTime())) return null;
  return {
    p_order_id: input.orderId,
    p_stripe_session_id: input.sessionId,
    p_confirmed_at: date.toISOString(),
    p_event_id: input.eventId,
  };
}
type DispatchClient = { rpc: (name: string, args: Record<string, unknown>) => { abortSignal: (signal: AbortSignal) => PromiseLike<{ error: unknown }> } };
/** Invoke only AFTER the existing payment RPC has committed and returned an order.
 * A timing failure must never change a successful payment response to a failure.
 * Null deadlines remain visible as unknown and can be repaired with the SAME
 * verified Stripe event. Never use receipt time, checkout age or current settings.
 */
export async function recordDispatchConfirmation(client: DispatchClient, input: DispatchConfirmation) {
  try {
    const args = dispatchConfirmationArguments(input);
    if (!args) return "unavailable" as const;
    const result = await client.rpc("record_order_dispatch_confirmation", args).abortSignal(AbortSignal.timeout(1500));
    return result.error ? "unavailable" as const : "recorded_or_already_set" as const;
  } catch {
    return "unavailable" as const;
  }
}
