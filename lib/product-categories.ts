export const PRODUCT_CATEGORIES = [
  "Apparel",
  "Jewellery",
  "Books",
  "Gifts",
  "Bookmarks",
  "Home & Living",
  "Art",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export function isProductCategory(value: string): value is ProductCategory {
  return (PRODUCT_CATEGORIES as readonly string[]).includes(value);
}
