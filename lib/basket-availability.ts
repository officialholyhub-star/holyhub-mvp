import type { BasketItem } from "./basket";

export type BasketProduct = {
  id: string; name: string; price: number | string; currency: string;
  stock_quantity: number; category_type: string;
  product_variants: { id: string; size: string; stock_quantity: number }[];
  lister_storefronts: { delivery_option: string; delivery_charge: number | string; delivery_country: string } | { delivery_option: string; delivery_charge: number | string; delivery_country: string }[] | null;
};
const money = (price: number) => `£${price.toFixed(2)}`;
export function basketItemIssue(item: BasketItem, products: BasketProduct[]) {
  const product = products.find(p => p.id === item.id);
  const name = item.name + (item.variantSize ? ` (${item.variantSize})` : "");
  if (!product) return `${name} is no longer available. Remove it from your basket.`;
  const variant = item.variantId ? product.product_variants?.find(v => v.id === item.variantId) : null;
  if ((product.category_type !== "Apparel" && item.variantId) || (item.variantId && !variant) || (product.category_type === "Apparel" && product.product_variants?.length && !variant)) return `The selected size of ${name} is no longer available. Review the product or remove it.`;
  const stock = variant?.stock_quantity ?? product.stock_quantity;
  if (stock < 1) return `${name} is now out of stock.`;
  if (item.quantity > stock) return `Only ${stock} available. Your basket currently has ${item.quantity}.`;
  if (product.currency !== "GBP" || !Number.isFinite(Number(product.price)) || Number(product.price) < 0) return `${name} cannot currently be purchased. Remove it or try again later.`;
  if (Math.round(Number(product.price) * 100) !== Math.round(item.price * 100)) return `The price of ${name} has changed from ${money(item.price)} to ${money(Number(product.price))}.`;
  const shop = Array.isArray(product.lister_storefronts) ? product.lister_storefronts[0] : product.lister_storefronts;
  if (!shop || (shop.delivery_country ?? "GB") !== "GB") return `Delivery for ${name} is currently unavailable.`;
  const delivery = shop.delivery_option === "flat" ? Number(shop.delivery_charge) : 0;
  if (!Number.isFinite(delivery) || delivery < 0) return `Delivery for ${name} is currently unavailable.`;
  if (Math.round(delivery * 100) !== Math.round((item.deliveryOption === "flat" ? item.deliveryCharge : 0) * 100)) return `Delivery for ${name} has changed to ${money(delivery)} per seller order.`;
  return null;
}

// Explicit customer acceptance updates display values only. The server still
// independently reloads products, stock, variants, delivery and prices at checkout.
export function reviewBasketItem(item: BasketItem, product: BasketProduct): BasketItem | null {
  const variant = item.variantId ? product.product_variants?.find(v => v.id === item.variantId) : null;
  if ((product.category_type !== "Apparel" && item.variantId) || (item.variantId && !variant) || (product.category_type === "Apparel" && product.product_variants?.length && !variant)) return null;
  const stock = variant?.stock_quantity ?? product.stock_quantity;
  const shop = Array.isArray(product.lister_storefronts) ? product.lister_storefronts[0] : product.lister_storefronts;
  if (stock < 1 || !shop || (shop.delivery_country ?? "GB") !== "GB" || product.currency !== "GBP" || !Number.isFinite(Number(product.price)) || Number(product.price) < 0) return null;
  return { ...item, price: Number(product.price), stockQuantity: stock, quantity: Math.min(item.quantity, stock), deliveryOption: shop.delivery_option === "flat" ? "flat" : "free", deliveryCharge: shop.delivery_option === "flat" ? Number(shop.delivery_charge) : 0 };
}

export function basketReviewLabel(item: BasketItem, product: BasketProduct) {
  const updated = reviewBasketItem(item, product);
  return updated && updated.quantity < item.quantity ? `Update to ${updated.quantity}` : "Use updated information";
}
