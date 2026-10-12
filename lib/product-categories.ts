export const PRODUCT_CATEGORIES = [
  "Apparel",
  "Bookmarks",
  "Gifts",
  "Books",
  "Jewellery",
  "Home & Living",
  "Arts",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export function isProductCategory(value: string): value is ProductCategory {
  return (PRODUCT_CATEGORIES as readonly string[]).includes(value);
}

// Existing products may retain their saved category until the lister changes it.
export function isAllowedProductCategory(value: string, existingCategory?: string) {
  return isProductCategory(value) || (!!value && value === existingCategory);
}

export function marketplaceCategoryValues(category: string): string[] {
  return category === "Arts" ? ["Arts", "Art"] : [category];
}

export function productCategoryLabel(category: string) {
  return category === "Art" ? "Arts" : category;
}
