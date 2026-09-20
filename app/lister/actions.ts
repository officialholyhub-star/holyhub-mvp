"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function messageUrl(path: string, kind: "error" | "message", message: string) {
  return `${path}?${kind}=${encodeURIComponent(message)}`;
}

function parsePrice(value: string) {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value)) return null;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

function parseDeliveryCharge(value: string) {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value)) return null;
  const charge = Number(value);
  return Number.isFinite(charge) && charge >= 0 ? charge : null;
}

function parseStockQuantity(value: string) {
  if (!/^\d+$/.test(value)) return null;
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity >= 0 ? quantity : null;
}

function isValidHttpUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function saveStorefront(formData: FormData) {
  const businessName = clean(formData.get("business_name"));
  const description = clean(formData.get("description"));
  const categoryType = clean(formData.get("category_type"));
  const websiteOrSocial = clean(formData.get("website_or_social"));
  const deliveryOption = clean(formData.get("delivery_option"));
  const deliveryChargeValue = clean(formData.get("delivery_charge"));
  const deliveryCharge = parseDeliveryCharge(deliveryChargeValue);
  const { supabase, user } = await requireRole("lister");

  if (!businessName || businessName.length > 150 || !description || description.length > 500 || !categoryType || categoryType.length > 100 || websiteOrSocial.length > 500 || !isValidHttpUrl(websiteOrSocial) || !["free", "flat"].includes(deliveryOption) || deliveryCharge === null || (deliveryOption === "free" && deliveryCharge !== 0) || (deliveryOption === "flat" && deliveryCharge < 0)) {
    redirect(messageUrl("/lister/storefront", "error", "Complete the storefront and delivery settings with valid values."));
  }

  const { data: existingStorefront, error: lookupError } = await supabase
    .from("lister_storefronts")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (lookupError) {
    console.error("Lister storefront lookup failed", {
      code: lookupError.code,
      message: lookupError.message,
      details: lookupError.details,
      hint: lookupError.hint,
    });
    redirect(messageUrl("/lister/storefront", "error", "We couldn't load your storefront."));
  }

  const storefrontValues = {
    business_name: businessName,
    description,
    category_type: categoryType,
    website_or_social: websiteOrSocial || null,
    delivery_option: deliveryOption,
    delivery_charge: deliveryOption === "free" ? 0 : deliveryCharge,
    delivery_country: "GB",
    updated_at: new Date().toISOString(),
  };
  const saveResult = existingStorefront
    ? await supabase.from("lister_storefronts").update(storefrontValues).eq("user_id", user.id)
    : await supabase.from("lister_storefronts").insert({ ...storefrontValues, user_id: user.id });

  if (saveResult.error) {
    console.error("Lister storefront save failed", {
      code: saveResult.error.code,
      message: saveResult.error.message,
      details: saveResult.error.details,
      hint: saveResult.error.hint,
    });
    redirect(messageUrl("/lister/storefront", "error", "We couldn't save your storefront."));
  }
  revalidatePath("/lister/storefront");
  revalidatePath("/marketplace");
  revalidatePath(`/lister/storefront/${user.id}`);
  redirect(messageUrl("/lister/storefront", "message", "Storefront saved."));
}

function productValues(formData: FormData) {
  const name = clean(formData.get("name"));
  const description = clean(formData.get("description"));
  const categoryType = clean(formData.get("category_type"));
  const priceValue = clean(formData.get("price"));
  const imageUrl = clean(formData.get("image_url"));
  const stockQuantityValue = clean(formData.get("stock_quantity"));
  const price = parsePrice(priceValue);
  const stockQuantity = parseStockQuantity(stockQuantityValue);
  const isPublished = formData.get("is_published") === "on";

  if (!name || name.length > 150 || !description || description.length > 1000 || !categoryType || categoryType.length > 100 || price === null || stockQuantity === null || imageUrl.length > 500 || !isValidHttpUrl(imageUrl)) {
    return null;
  }

  return { name, description, category_type: categoryType, price, currency: "GBP", image_url: imageUrl || null, stock_quantity: stockQuantity, is_published: isPublished };
}

export async function createProduct(formData: FormData) {
  const values = productValues(formData);
  if (!values) redirect(messageUrl("/lister/products/new", "error", "Complete the product fields with valid values."));
  const { supabase, user } = await requireRole("lister");
  const { error } = await supabase.from("products").insert({ ...values, lister_user_id: user.id });
  if (error) redirect(messageUrl("/lister/products/new", "error", "We couldn't create that product."));
  revalidatePath("/lister/products");
  revalidatePath("/marketplace");
  redirect("/lister/products?message=Product%20created.");
}

export async function updateProduct(formData: FormData) {
  const productId = clean(formData.get("product_id"));
  const values = productValues(formData);
  if (!productId || !values) redirect(messageUrl("/lister/products", "error", "Complete the product fields with valid values."));
  const { supabase, user } = await requireRole("lister");
  const { error } = await supabase.from("products").update({ ...values, updated_at: new Date().toISOString() }).eq("id", productId).eq("lister_user_id", user.id);
  if (error) redirect(messageUrl("/lister/products", "error", "We couldn't update that product."));
  revalidatePath("/lister/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/marketplace");
  redirect("/lister/products?message=Product%20updated.");
}

export async function deleteProduct(formData: FormData) {
  const productId = clean(formData.get("product_id"));
  const { supabase, user } = await requireRole("lister");
  if (!productId) redirect(messageUrl("/lister/products", "error", "That product could not be found."));
  const { error } = await supabase.from("products").delete().eq("id", productId).eq("lister_user_id", user.id);
  if (error) redirect(messageUrl("/lister/products", "error", "We couldn't delete that product."));
  revalidatePath("/lister/products");
  revalidatePath("/marketplace");
  redirect("/lister/products?message=Product%20deleted.");
}