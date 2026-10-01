export const FULFILMENT_STATUSES = ["pending", "packed", "dispatched", "delivered", "cancelled"] as const;
export type FulfilmentStatus = (typeof FULFILMENT_STATUSES)[number];

export const FULFILMENT_STATUS_LABELS: Record<FulfilmentStatus, string> = {
  pending: "Unfulfilled",
  packed: "Processing",
  dispatched: "Dispatched",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const CARRIERS = ["Royal Mail", "Evri", "DPD", "DHL", "Yodel", "Other"] as const;
export type Carrier = (typeof CARRIERS)[number];

export function isFulfilmentStatus(value: string): value is FulfilmentStatus {
  return (FULFILMENT_STATUSES as readonly string[]).includes(value);
}

export function isCarrier(value: string): value is Carrier {
  return (CARRIERS as readonly string[]).includes(value);
}

export function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]) {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}

export function formatDeliveryAddress(address: {
  delivery_recipient_name?: string | null;
  delivery_address_line1?: string | null;
  delivery_address_line2?: string | null;
  delivery_city?: string | null;
  delivery_postcode?: string | null;
  delivery_country?: string | null;
}) {
  return [
    address.delivery_recipient_name,
    address.delivery_address_line1,
    address.delivery_address_line2,
    address.delivery_city,
    address.delivery_postcode,
    address.delivery_country,
  ].filter(Boolean).join(", ");
}
