import { FULFILMENT_STATUS_LABELS, isFulfilmentStatus } from "./fulfilment";
export function orderPresentation(status: string, paymentStatus?: string) {
  if (paymentStatus === "failed") return { tone: "urgent", label: "Payment failed · Needs attention" };
  if (paymentStatus === "cancelled" || status === "cancelled") return { tone: "neutral", label: "Cancelled" };
  const label = isFulfilmentStatus(status) ? FULFILMENT_STATUS_LABELS[status] : status;
  return { tone: status === "delivered" ? "complete" : status === "packed" || status === "dispatched" ? "progress" : "neutral", label };
}
