export const productCategories = ["Clothing & Accessories", "Beauty & Wellbeing", "Books & Stationery", "Home & Gifts", "Food & Drink", "Art & Prints", "Digital Products", "Other"] as const;
export type Product = { id: string; business_id: string; name: string; description: string; category: string; price_pence: number; stock: number; delivery_info: string; status: string; moderation_status: string; listing_number: number; created_at: string };
export type ProductValues = { name: string; description: string; category: string; price: string; stock: string; delivery_info: string };
export type ProductState = { error?: string; values?: Partial<ProductValues> };
export type Order = { id: string; customer_id: string; status: string; subtotal_pence: number; paid_at: string | null; created_at: string };
export type OrderItem = { id: string; order_id: string; seller_order_id: string; business_id: string; product_id: string; product_name: string; quantity: number; unit_price_pence: number; total_pence: number; commission_pence: number };
export type SellerOrder = { id: string; order_id: string; business_id: string; gross_pence: number; commission_pence: number; reserve_pence: number | null; reserve_release_at: string | null; refunded_pence: number; transferred_pence: number; fulfillment_status: string; tracking_note: string | null };
export type RefundCase = { id: string; order_item_id: string; business_id: string; customer_id: string; reason: string; explanation: string; desired_resolution: string; contacted_seller: boolean; requested_pence: number; seller_response: string | null; status: string; approved_pence: number; decision_note: string | null; appeal_deadline: string | null; appeal_limit: number | null; appeal_count: number; payment_status: string; created_at: string };
export type Settings = { id: boolean; commission_bps: number; free_listing_limit: number; listing_fee_pence: number; listing_allowance_mode: string | null; new_reserve_bps: number | null; new_reserve_days: number | null; established_reserve_bps: number | null; established_reserve_days: number | null; high_risk_reserve_bps: number | null; high_risk_reserve_days: number | null; appeal_days: number | null; appeal_limit: number | null; shipping_policy: string | null; tax_policy: string | null };
export const money = (pence: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
export const statusLabel = (value: string) => value.replaceAll("_", " ");
export const readText = (form: FormData, key: string) => typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";

export function poundsToPence(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{1,7}(\.\d{1,2})?$/.test(value.trim())) return null;
  const [pounds, pennies = ""] = value.trim().split(".");
  const total = Number(pounds) * 100 + Number(pennies.padEnd(2, "0"));
  return Number.isSafeInteger(total) && total <= 100000000 ? total : null;
}
export function validateProduct(form: FormData) {
  const values: ProductValues = { name: readText(form,"name"), description: readText(form,"description"), category: readText(form,"category"), price: readText(form,"price"), stock: readText(form,"stock"), delivery_info: readText(form,"delivery_info") };
  const price = poundsToPence(values.price);
  let error;
  if (values.name.length < 2 || values.name.length > 120) error = "Use a product name between 2 and 120 characters.";
  else if (values.description.length < 20 || values.description.length > 5000) error = "Describe your product in 20–5,000 characters.";
  else if (!productCategories.includes(values.category as typeof productCategories[number])) error = "Choose a product category.";
  else if (price === null || price < 1) error = "Enter a positive price with no more than two decimal places.";
  else if (!/^\d{1,7}$/.test(values.stock) || Number(values.stock) > 1000000) error = "Enter a whole stock quantity from 0 to 1,000,000.";
  else if (values.delivery_info.length < 10 || values.delivery_info.length > 1500) error = "Explain delivery or fulfilment in 10–1,500 characters.";
  return { values, error, data: error ? undefined : { name: values.name, description: values.description, category: values.category, price_pence: price!, stock: Number(values.stock), delivery_info: values.delivery_info } };
}
export function friendlyError(error: { code?: string; message?: string } | null, fallback = "We couldn’t save that. Please try again.") {
  if (error?.code === "P0001") return error.message ?? fallback;
  if (error?.code === "23505") return "This record already exists. Refresh the page to see its current status.";
  return fallback;
}
