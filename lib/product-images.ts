export const MAX_PRODUCT_IMAGES = 5;
export type ProductImage = { image_url: string; sort_order: number };

export function orderedProductImages(images: readonly ProductImage[] | null | undefined, legacy: string | null | undefined): string[] {
  const urls = [...(images ?? [])].sort((a, b) => a.sort_order - b.sort_order).map(image => image.image_url);
  return urls.length ? urls : legacy ? [legacy] : [];
}

export function ownedProductImagePath(imageUrl: string, userId: string, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const image = new URL(imageUrl);
    if (!supabaseUrl || image.origin !== new URL(supabaseUrl).origin) return null;
    const prefix = `/storage/v1/object/public/product-images/${userId}/`;
    if (!image.pathname.startsWith(prefix)) return null;
    const filename = decodeURIComponent(image.pathname.slice(prefix.length));
    if (!filename || filename.includes("/") || filename.includes("\\") || filename === "." || filename === "..") return null;
    return `${userId}/${filename}`;
  } catch { return null; }
}

export function validProductImages(urls: readonly string[], userId: string, existing: readonly string[] = []) {
  return urls.length <= MAX_PRODUCT_IMAGES && new Set(urls).size === urls.length
    && urls.every(url => url.length > 0 && url.length <= 500 && (existing.includes(url) || ownedProductImagePath(url, userId) !== null));
}

export function moveProductImage(images: readonly string[], from: number, to: number) {
  const result = [...images];
  if (from < 0 || to < 0 || from >= result.length || to >= result.length) return result;
  const [image] = result.splice(from, 1); result.splice(to, 0, image);
  return result;
}

export function withProductCover<T extends { image_url: string | null; product_images?: ProductImage[] | null }>(product: T) {
  return { ...product, image_url: orderedProductImages(product.product_images, product.image_url)[0] ?? null };
}
