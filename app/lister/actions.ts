"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";
import { isProductCategory } from "@/lib/product-categories";
import { APPAREL_SIZES, hasAvailableApparelStock, hasValidApparelStock } from "@/lib/product-variants";

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

const PRODUCT_IMAGE_BUCKET = "product-images";
const LISTER_LOGO_BUCKET = "lister-logos";

function ownedProductImagePath(imageUrl: string, userId: string) {
  try {
    const image = new URL(imageUrl);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || image.origin !== new URL(supabaseUrl).origin) return null;

    const prefix = `/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${userId}/`;
    if (!image.pathname.startsWith(prefix)) return null;

    const filename = decodeURIComponent(image.pathname.slice(prefix.length));
    if (!filename || filename.includes("/") || filename.includes("\\")) return null;
    return `${userId}/${filename}`;
  } catch {
    return null;
  }
}

async function removeOwnedProductImage(supabase: Awaited<ReturnType<typeof requireRole>>["supabase"], imageUrl: string, userId: string) {
  const path = ownedProductImagePath(imageUrl, userId);
  if (!path) return;

  try {
    const { error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
    if (error) {
      console.error("Product image cleanup failed", { code: error.name, message: error.message });
    }
  } catch (error) {
    console.error("Product image cleanup failed", error);
  }
}

function ownedListerLogoPath(imageUrl: string, userId: string) {
  try {
    const image = new URL(imageUrl);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || image.origin !== new URL(supabaseUrl).origin) return null;

    const prefix = `/storage/v1/object/public/${LISTER_LOGO_BUCKET}/${userId}/`;
    if (!image.pathname.startsWith(prefix)) return null;

    const filename = decodeURIComponent(image.pathname.slice(prefix.length));
    if (!filename || filename.includes("/") || filename.includes("\\")) return null;
    return `${userId}/${filename}`;
  } catch {
    return null;
  }
}

async function removeOwnedListerLogo(supabase: Awaited<ReturnType<typeof requireRole>>["supabase"], imageUrl: string, userId: string) {
  const path = ownedListerLogoPath(imageUrl, userId);
  if (!path) return;

  try {
    const { error } = await supabase.storage.from(LISTER_LOGO_BUCKET).remove([path]);
    if (error) console.error("Lister logo cleanup failed", { code: error.name, message: error.message });
  } catch (error) {
    console.error("Lister logo cleanup failed", error);
  }
}

export type StorefrontFormState = { error: string };

export async function saveStorefront(_previousState: StorefrontFormState, formData: FormData): Promise<StorefrontFormState> {
  const businessName = clean(formData.get("business_name"));
  const description = clean(formData.get("description"));
  const categoryType = clean(formData.get("category_type"));
  const websiteUrl = clean(formData.get("website_url"));
  const instagramUrl = clean(formData.get("instagram_url"));
  const logoUrl = clean(formData.get("logo_url"));
  const deliveryChargeValue = clean(formData.get("delivery_charge"));
  const deliveryCharge = parseDeliveryCharge(deliveryChargeValue);
  const { supabase, user } = await requireRole("lister");

  if (!businessName || businessName.length > 150 || !description || description.length > 500 || !categoryType || categoryType.length > 100 || websiteUrl.length > 500 || instagramUrl.length > 500 || !isValidHttpUrl(websiteUrl) || !isValidHttpUrl(instagramUrl) || deliveryCharge === null || !deliveryChargeValue || logoUrl.length > 500) {
    return { error: "Complete the storefront and delivery settings with valid values." };
  }

  const { data: existingStorefront, error: lookupError } = await supabase
    .from("lister_storefronts")
    .select("user_id, logo_url")
    .eq("user_id", user.id)
    .maybeSingle();

  if (lookupError) {
    console.error("Lister storefront lookup failed", {
      code: lookupError.code,
      message: lookupError.message,
      details: lookupError.details,
      hint: lookupError.hint,
    });
    return { error: "We couldn't load your storefront." };
  }

  const logoIsAllowed = !logoUrl || logoUrl === existingStorefront?.logo_url || ownedListerLogoPath(logoUrl, user.id) !== null;
  if (!logoIsAllowed) {
    return { error: "Choose a logo uploaded to your storefront." };
  }

  const storefrontValues = {
    business_name: businessName,
    description,
    category_type: categoryType,
    website_url: websiteUrl || null,
    instagram_url: instagramUrl || null,
    logo_url: logoUrl || null,
    delivery_option: deliveryCharge === 0 ? "free" : "flat",
    delivery_charge: deliveryCharge,
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
    return { error: "We couldn't save your storefront." };
  }
  if (existingStorefront?.logo_url && existingStorefront.logo_url !== logoUrl) {
    await removeOwnedListerLogo(supabase, existingStorefront.logo_url, user.id);
  }
  revalidatePath("/lister/storefront");
  revalidatePath("/marketplace");
  revalidatePath(`/lister/storefront/${user.id}`);
  revalidatePath("/account");
  redirect("/account?message=Storefront%20saved.");
}

function variantValues(formData: FormData, categoryType: string, isPublished: boolean) {
  if (categoryType !== "Apparel") return { sizes: [], stockQuantities: [] };
  const stockQuantities = APPAREL_SIZES.map((size) => parseStockQuantity(clean(formData.get(`variant_${size}`))));
  return stockQuantities.some((quantity) => quantity === null)
    || !hasValidApparelStock(stockQuantities as number[])
    || (isPublished && !hasAvailableApparelStock(stockQuantities as number[]))
    ? null
    : { sizes: [...APPAREL_SIZES], stockQuantities: stockQuantities as number[] };
}

function productValues(formData: FormData, userId: string, existingImageUrl: string | null = null) {
  const name = clean(formData.get("name"));
  const description = clean(formData.get("description"));
  const categoryType = clean(formData.get("category_type"));
  const priceValue = clean(formData.get("price"));
  const imageUrl = clean(formData.get("image_url"));
  const stockQuantityValue = clean(formData.get("stock_quantity"));
  const price = parsePrice(priceValue);
  const stockQuantity = parseStockQuantity(stockQuantityValue);
  const sizeGuideUrl = clean(formData.get("size_guide_url"));
  const isPublished = formData.get("is_published") === "on";

  const imageIsAllowed = !imageUrl || imageUrl === existingImageUrl || ownedProductImagePath(imageUrl, userId) !== null;
  if (!name || name.length > 150 || !description || description.length > 1000 || !isProductCategory(categoryType) || price === null || stockQuantity === null || imageUrl.length > 500 || sizeGuideUrl.length > 500 || !isValidHttpUrl(sizeGuideUrl) || !imageIsAllowed) {
    return null;
  }

  return { name, description, category_type: categoryType, price, currency: "GBP", image_url: imageUrl || null, size_guide_url: sizeGuideUrl || null, stock_quantity: stockQuantity, is_published: isPublished };
}

async function saveProductVariants(supabase: Awaited<ReturnType<typeof requireRole>>["supabase"], productId: string, categoryType: string, isPublished: boolean, formData: FormData) {
  const values = variantValues(formData, categoryType, isPublished);
  if (!values) return false;
  const { error } = await supabase.rpc("save_product_variants", {
    p_product_id: productId,
    p_sizes: values.sizes,
    p_stock_quantities: values.stockQuantities,
  });
  return !error;
}

export async function createProduct(formData: FormData) {
  const { supabase, user } = await requireRole("lister");
  if (formData.get("is_published") === "on" && !clean(formData.get("image_url"))) {
    redirect(messageUrl("/lister/products/new", "error", "Add at least one product image before submitting this product for review."));
  }
  const values = productValues(formData, user.id);
  if (!values) redirect(messageUrl("/lister/products/new", "error", "Complete the product fields with valid values."));
  const { data: product, error } = await supabase.from("products").insert({ ...values, lister_user_id: user.id }).select("id").single();
  if (error || !product || !(await saveProductVariants(supabase, product.id, values.category_type, values.is_published, formData))) {
    if (product) await supabase.from("products").delete().eq("id", product.id).eq("lister_user_id", user.id);
    redirect(messageUrl("/lister/products/new", "error", "Add valid stock for every apparel size before creating the listing."));
  }
  revalidatePath("/lister/products");
  revalidatePath("/marketplace");
  redirect("/lister/products?message=Product%20created.");
}

export async function updateProduct(formData: FormData) {
  const productId = clean(formData.get("product_id"));
  const { supabase, user } = await requireRole("lister");
  if (!productId) redirect(messageUrl("/lister/products", "error", "Complete the product fields with valid values."));

  const { data: existingProduct, error: lookupError } = await supabase
    .from("products")
    .select("image_url")
    .eq("id", productId)
    .eq("lister_user_id", user.id)
    .maybeSingle();
  if (lookupError || !existingProduct) redirect(messageUrl("/lister/products", "error", "We couldn't update that product."));

  if (formData.get("is_published") === "on" && !clean(formData.get("image_url"))) {
    redirect(messageUrl(`/lister/products/${productId}/edit`, "error", "Add at least one product image before submitting this product for review."));
  }

  const values = productValues(formData, user.id, existingProduct.image_url);
  if (!values) redirect(messageUrl("/lister/products", "error", "Complete the product fields with valid values."));
  const { error } = await supabase.from("products").update({ ...values, updated_at: new Date().toISOString() }).eq("id", productId).eq("lister_user_id", user.id);
  if (error) redirect(messageUrl("/lister/products", "error", "We couldn't update that product."));
  if (!(await saveProductVariants(supabase, productId, values.category_type, values.is_published, formData))) {
    redirect(messageUrl(`/lister/products/${productId}/edit`, "error", "Add valid stock for every apparel size before saving the product."));
  }
  if (existingProduct.image_url && existingProduct.image_url !== values.image_url) {
    await removeOwnedProductImage(supabase, existingProduct.image_url, user.id);
  }
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