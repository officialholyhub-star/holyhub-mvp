export const APPAREL_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export type ApparelSize = (typeof APPAREL_SIZES)[number];

export function hasValidApparelStock(values: readonly number[]) {
  return values.length === APPAREL_SIZES.length
    && values.every((value) => Number.isSafeInteger(value) && value >= 0);
}

export function hasAvailableApparelStock(values: readonly number[]) {
  return hasValidApparelStock(values) && values.some((value) => value > 0);
}

export function variantLineKey(productId: string, variantId?: string) {
  return `${productId}:${variantId ?? "base"}`;
}
