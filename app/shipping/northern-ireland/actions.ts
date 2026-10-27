"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_BASKET_ITEMS, MAX_BASKET_QUANTITY } from "@/lib/basket";
import { singleText } from "@/lib/delivery-territory";

function demandError(message: string): never {
  redirect(`/shipping/northern-ireland?error=${encodeURIComponent(message)}`);
}

export async function requestNorthernIrelandShipping(data: FormData) {
  const { supabase, user } = await requireUser();
  const area = singleText(data, "postcode_area")?.toUpperCase();
  if (!area || !/^BT(?:[1-9]|[1-8][0-9]|9[0-4])$/.test(area)) demandError("Enter your broad Northern Ireland postcode district, for example BT7. Do not enter a full address.");
  const notifyValues = data.getAll("notify");
  if (notifyValues.length > 1 || (notifyValues.length === 1 && notifyValues[0] !== "on")) demandError("Please review the notification choice.");
  const notify = notifyValues[0] === "on";
  const email = notify ? singleText(data, "notification_email") : null;
  if (notify && (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) demandError("Enter an email for your optional notification, or leave notification unchecked.");
  let submitted: unknown;
  try { submitted = JSON.parse(singleText(data, "basket") ?? ""); } catch { demandError("Your basket could not be read. Please review it and try again."); }
  if (!Array.isArray(submitted) || submitted.length < 1 || submitted.length > MAX_BASKET_ITEMS) demandError("Please add the products you want to your basket first.");
  const items = new Map<string, { id: string; quantity: number; variantId: string | null }>();
  for (const raw of submitted) {
    if (!raw || typeof raw !== "object") demandError("Please review your basket.");
    const id = raw.id, quantity = raw.quantity, variantId = raw.variantId ?? null;
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_BASKET_QUANTITY
      || (variantId !== null && (typeof variantId !== "string" || !/^[0-9a-f-]{36}$/i.test(variantId)))) demandError("Please review your basket.");
    const key = `${id}:${variantId ?? "base"}`;
    const total = (items.get(key)?.quantity ?? 0) + quantity;
    if (total > MAX_BASKET_QUANTITY) demandError("Please review your basket quantity.");
    items.set(key, { id, quantity: total, variantId });
  }
  const normalized = [...items.values()].sort((a, b) => `${a.id}:${a.variantId}`.localeCompare(`${b.id}:${b.variantId}`));
  const ids = [...new Set(normalized.map(item => item.id))];
  const { data: products, error } = await supabase.from("products")
    .select("id, name, lister_user_id, is_published, review_status, product_variants(id, size)")
    .in("id", ids).eq("is_published", true).eq("review_status", "approved");
  if (error || !products || products.length !== ids.length) demandError("Some products could not be verified. Please review your basket.");
  const sellers = [...new Set(products.map(p => p.lister_user_id))];
  const { data: brands, error: brandError } = await supabase.from("lister_storefronts")
    .select("user_id, business_name").in("user_id", sellers);
  if (brandError || !brands || brands.length !== sellers.length) demandError("Seller details could not be verified. Please try again.");
  const demandItems = normalized.map(item => {
    const product = products.find(p => p.id === item.id);
    if (!product || !product.is_published || product.review_status !== "approved") demandError("Please review your basket.");
    const variant = item.variantId ? product.product_variants?.find(v => v.id === item.variantId) : null;
    if (item.variantId && !variant) demandError("Please review the selected product option.");
    return { product_id: product.id, product_name: product.name, seller_user_id: product.lister_user_id,
      seller_brand: brands.find(b => b.user_id === product.lister_user_id)!.business_name,
      quantity: item.quantity, variant_id: variant?.id ?? null, variant_size: variant?.size ?? null };
  });
  // Only these explicit fields are persisted. Never forward address/client product metadata.
  const { error: writeError } = await createAdminClient().from("ni_shipping_interest").upsert({
    user_id: user.id, postcode_area: area,
    demand_key: createHash("sha256").update(JSON.stringify(normalized)).digest("hex"),
    demand_items: demandItems, notification_email: notify ? email : null,
  }, { onConflict: "user_id,postcode_area,demand_key" });
  if (writeError) demandError("Your request could not be recorded. Please try again.");
  redirect("/shipping/northern-ireland?requested=yes");
}
