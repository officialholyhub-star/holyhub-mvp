import "server-only";
import { orderConfirmationIdempotencyKey } from "@/lib/order-confirmation";

export type OrderConfirmationTriggerBlocker =
  | "c5_seller_identity_pending"
  | "durable_delivery_not_configured";

export type OrderConfirmationTriggerState = {
  status: "blocked";
  orderId: string;
  idempotencyKey: string;
  blockers: OrderConfirmationTriggerBlocker[];
};

/**
 * C6 launch shell only.
 *
 * This marks the safe post-payment trigger point without sending anything.
 * It deliberately remains fail-closed until C5 provides the seller legal
 * identity snapshot and a durable, deduplicated email-delivery path is added.
 */
export function prepareOrderConfirmationTrigger(orderId: string): OrderConfirmationTriggerState {
  const cleanOrderId = orderId.trim();
  if (!cleanOrderId) throw new Error("Order confirmation trigger requires an order ID.");

  return {
    status: "blocked",
    orderId: cleanOrderId,
    idempotencyKey: orderConfirmationIdempotencyKey(cleanOrderId),
    blockers: ["c5_seller_identity_pending", "durable_delivery_not_configured"],
  };
}
