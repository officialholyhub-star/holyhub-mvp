"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";
import { parsePrice, parseStockQuantity, isValidHttpUrl } from "@/lib/product-validation";
import { orderedProductImages, ownedProductImagePath, validProductImages } from "@/lib/product-images";
import { isProductCategory } from "@/lib/product-categories";
import { APPAREL_SIZES, hasAvailableApparelStock, hasValidApparelStock } from "@/lib/product-variants";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function messageUrl(path: string, kind: "error" | "message", message: string) {
  return `${path}?${kind}=${encodeURIComponent(message)}`;
}

function parseDeliveryCharge(value: string) {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value)) return null;
  const charge = Number(value);
  return Number.isFinite(charge) && charge >= 0 ? charge : null;
}

const LISTER_LOGO_BUCKET = "lister-logos";

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

function productValues(formData: FormData, userId: string, existingImages: readonly string[] = []) {
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

  const imageIsAllowed = !imageUrl || existingImages.includes(imageUrl) || ownedProductImagePath(imageUrl, userId) !== null;
  if (!name || name.length > 150 || !description || description.length > 1000 || !isProductCategory(categoryType) || price === null || stockQuantity === null || imageUrl.length > 500 || sizeGuideUrl.length > 500 || !isValidHttpUrl(sizeGuideUrl) || !imageIsAllowed) {
    return null;
  }

  return { name, description, category_type: categoryType, price, currency: "GBP", image_url: imageUrl || null, size_guide_url: sizeGuideUrl || null, stock_quantity: stockQuantity, is_published: isPublished };
}

function submittedImages(formData: FormData) {
  const images = formData.getAll("image_urls").filter((value): value is string => typeof value === "string").map(value => value.trim());
  return formData.get("gallery_present") === "1" ? images : clean(formData.get("image_url")) ? [clean(formData.get("image_url"))] : [];
}

export async function createProduct(formData: FormData) {
  const { supabase, user } = await requireRole("lister");
  const images = submittedImages(formData);
  if (formData.get("is_published") === "on" && !images.length) {
    redirect(messageUrl("/lister/products/new", "error", "Add at least one product image before submitting this product for review."));
  }
  formData.set("image_url", images[0] ?? "");
  const values = productValues(formData, user.id);
  const variants = variantValues(formData, values?.category_type ?? "", values?.is_published ?? false);
  if (!values || !variants || !validProductImages(images, user.id)) redirect(messageUrl("/lister/products/new", "error", "Complete the product fields, images and size stock with valid values."));
  const { error } = await supabase.rpc("save_product_with_images", {
    p_product_id: null, p_values: values, p_images: images,
    p_sizes: variants.sizes, p_stock_quantities: variants.stockQuantities,
  });
  if (error) redirect(messageUrl("/lister/products/new", "error", "We couldn't save your product. Your previous images have not been removed."));
  revalidatePath("/lister/products");
  revalidatePath("/marketplace");
  revalidatePath("/");
  revalidatePath(`/lister/storefront/${user.id}`);
  redirect("/lister/products?message=Product%20created.");
}

export async function updateProduct(formData: FormData) {
  const productId = clean(formData.get("product_id"));
  const { supabase, user } = await requireRole("lister");
  if (!productId) redirect(messageUrl("/lister/products", "error", "Complete the product fields with valid values."));
  const { data: existingProduct, error: lookupError } = await supabase.from("products")
    .select("image_url, product_images(image_url, sort_order)").eq("id", productId).eq("lister_user_id", user.id).maybeSingle();
  if (lookupError || !existingProduct) redirect(messageUrl("/lister/products", "error", "We couldn't update that product."));
  const images = submittedImages(formData);
  const existingImages = orderedProductImages(existingProduct.product_images, existingProduct.image_url);
  if (formData.get("is_published") === "on" && !images.length) {
    redirect(messageUrl(`/lister/products/${productId}/edit`, "error", "Add at least one product image before submitting this product for review."));
  }
  formData.set("image_url", images[0] ?? "");
  const values = productValues(formData, user.id, existingImages);
  const variants = variantValues(formData, values?.category_type ?? "", values?.is_published ?? false);
  if (!values || !variants || !validProductImages(images, user.id, existingImages)) redirect(messageUrl(`/lister/products/${productId}/edit`, "error", "Complete the product fields, images and size stock with valid values."));
  const { error } = await supabase.rpc("save_product_with_images", {
    p_product_id: productId, p_values: values, p_images: images,
    p_sizes: variants.sizes, p_stock_quantities: variants.stockQuantities,
  });
  if (error) redirect(messageUrl(`/lister/products/${productId}/edit`, "error", "We couldn't save your product. Your previous images have not been removed."));
  // Persisted files are retained: review snapshots and other listings may still
  // reference them. Only unsaved uploads are discarded in the uploader.
  revalidatePath("/lister/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/marketplace");
  revalidatePath("/account/favourites");
  revalidatePath("/");
  revalidatePath(`/lister/storefront/${user.id}`);
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