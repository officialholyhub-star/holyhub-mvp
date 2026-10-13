// Stable reason keys leave room for dedicated cancellation audit fields later.
export const CANCELLATION_REASONS = {
  customer_requested: "Customer requested cancellation",
  item_unavailable: "Item unavailable",
  unable_to_fulfil: "Unable to fulfil order",
  delivery_issue: "Address / delivery issue",
  duplicate_order: "Duplicate order",
  other: "Other",
} as const;

export function validCancellationReason(reason: string, customReason: string) {
  return Object.hasOwn(CANCELLATION_REASONS, reason)
    && (reason !== "other" || (customReason.trim().length > 0 && customReason.trim().length <= 240));
}
