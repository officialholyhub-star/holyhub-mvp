export type CheckoutPriceLine = {
  listerId: string;
  lineTotal: number;
  deliveryAmount: number;
};

export function toPence(value: string | number) {
  if (typeof value === "number" && (!Number.isFinite(value) || value < 0
    || Math.abs(value - Math.round(value * 100) / 100) > Number.EPSILON * Math.max(1, Math.abs(value)))) return null;
  const normalized = typeof value === "number" ? value.toFixed(2) : value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [pounds, pennies = ""] = normalized.split(".");
  const amount = Number(pounds) * 100 + Number(pennies.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

export function calculateHolyHubCommission(productSubtotal: number) {
  if (!Number.isSafeInteger(productSubtotal) || productSubtotal < 0) return null;
  const wholeUnits = Math.floor(productSubtotal / 20);
  const remainder = productSubtotal % 20;
  const commission = wholeUnits + (remainder >= 10 ? 1 : 0);
  return Number.isSafeInteger(commission) ? commission : null;
}

export function calculateCheckoutTotals(lines: readonly CheckoutPriceLine[]) {
  let productSubtotal = 0;
  const deliveryGroups = new Map<string, number>();

  for (const line of lines) {
    if (!Number.isSafeInteger(line.lineTotal) || line.lineTotal < 0
      || !Number.isSafeInteger(line.deliveryAmount) || line.deliveryAmount < 0) return null;
    productSubtotal += line.lineTotal;
    if (!Number.isSafeInteger(productSubtotal)) return null;
    const currentDelivery = deliveryGroups.get(line.listerId);
    if (currentDelivery !== undefined && currentDelivery !== line.deliveryAmount) return null;
    deliveryGroups.set(line.listerId, line.deliveryAmount);
  }

  const deliveryTotal = Array.from(deliveryGroups.values()).reduce((sum, amount) => sum + amount, 0);
  const total = productSubtotal + deliveryTotal;
  if (!Number.isSafeInteger(deliveryTotal) || !Number.isSafeInteger(total)) return null;
  return { productSubtotal, deliveryGroups, deliveryTotal, total };
}
