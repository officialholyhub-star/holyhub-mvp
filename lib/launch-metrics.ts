export type CheckoutMetricRow = {
  status: "pending" | "paid" | "cancelled" | "failed" | string;
};

export type OrderMetricRow = {
  order_status: "pending_payment" | "paid" | "cancelled" | "failed" | string;
  total_amount: number;
  product_subtotal: number;
  delivery_total: number;
  holyhub_commission: number;
  stripe_processing_fee?: number | null;
  paid_at?: string | null;
};

export type FulfilmentMetricRow = {
  fulfilment_status: "pending" | "packed" | "dispatched" | "delivered" | "cancelled" | string;
};

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[key(row)] = (counts[key(row)] ?? 0) + 1;
  return counts;
}

function sum(rows: OrderMetricRow[], key: keyof Pick<OrderMetricRow, "total_amount" | "product_subtotal" | "delivery_total" | "holyhub_commission">) {
  return rows.reduce((total, row) => total + (Number.isSafeInteger(row[key]) ? Number(row[key]) : 0), 0);
}

export function calculateLaunchMetrics(checkouts: CheckoutMetricRow[], orders: OrderMetricRow[], fulfilment: FulfilmentMetricRow[]) {
  const checkoutCounts = countBy(checkouts, row => row.status);
  const fulfilmentCounts = countBy(fulfilment, row => row.fulfilment_status);
  const paidCheckouts = checkoutCounts.paid ?? 0;
  const checkoutStarts = checkouts.length;
  const paidOrders = orders.filter(order => Boolean(order.paid_at));
  const feeRecordedOrders = paidOrders.filter(order => Number.isSafeInteger(order.stripe_processing_fee)).length;

  return {
    checkoutStarts,
    paidCheckouts,
    pendingCheckouts: checkoutCounts.pending ?? 0,
    failedCheckouts: checkoutCounts.failed ?? 0,
    cancelledCheckouts: checkoutCounts.cancelled ?? 0,
    checkoutConversionRate: checkoutStarts ? paidCheckouts / checkoutStarts : null,
    paidOrderCount: paidOrders.length,
    recordedOrderValue: sum(paidOrders, "total_amount"),
    recordedProductValue: sum(paidOrders, "product_subtotal"),
    recordedDeliveryValue: sum(paidOrders, "delivery_total"),
    recordedHolyHubCommission: sum(paidOrders, "holyhub_commission"),
    stripeFeeCoverage: paidOrders.length ? feeRecordedOrders / paidOrders.length : null,
    fulfilment: {
      pending: fulfilmentCounts.pending ?? 0,
      packed: fulfilmentCounts.packed ?? 0,
      dispatched: fulfilmentCounts.dispatched ?? 0,
      delivered: fulfilmentCounts.delivered ?? 0,
      cancelled: fulfilmentCounts.cancelled ?? 0,
    },
    orderIntegrityMatches: paidCheckouts === paidOrders.length,
  };
}
