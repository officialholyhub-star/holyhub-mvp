export function parsePrice(value: string) {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value)) return null;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

export function parseStockQuantity(value: string) {
  if (!/^\d+$/.test(value)) return null;
  const quantity = Number(value);
  return Number.isSafeInteger(quantity) && quantity >= 0 && quantity <= 2147483647 ? quantity : null;
}

export function isValidHttpUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
