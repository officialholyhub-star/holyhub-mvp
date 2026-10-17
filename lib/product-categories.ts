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

export const CUSTOMER_PRODUCT_CATEGORIES = [
  "Clothing & Accessories",
  "Jewellery",
  "Books & Stationery",
  "Gifts",
  "Home & Living",
  "Art & Prints",
] as const;

export type CustomerProductCategory = (typeof CUSTOMER_PRODUCT_CATEGORIES)[number];

export function isProductCategory(value: string): value is ProductCategory {
  return (PRODUCT_CATEGORIES as readonly string[]).includes(value);
}

export function isCustomerProductCategory(value: string): value is CustomerProductCategory {
  return (CUSTOMER_PRODUCT_CATEGORIES as readonly string[]).includes(value);
}

// Existing products may retain their saved category until the lister changes it.
export function isAllowedProductCategory(value: string, existingCategory?: string) {
  return isProductCategory(value) || (!!value && value === existingCategory);
}

export function productCategoryLabel(category: string): string {
  switch (category) {
    case "Apparel": return "Clothing & Accessories";
    case "Bookmarks":
    case "Books": return "Books & Stationery";
    case "Arts":
    case "Art": return "Art & Prints";
    case "Jewellery": return "Jewellery";
    case "Gifts": return "Gifts";
    case "Home & Living": return "Home & Living";
    default: return category;
  }
}

export function marketplaceCategoryValues(category: string): string[] {
  switch (category) {
    case "Clothing & Accessories": return ["Apparel"];
    case "Books & Stationery": return ["Books", "Bookmarks"];
    case "Art & Prints": return ["Arts", "Art"];
    case "Jewellery": return ["Jewellery"];
    case "Gifts": return ["Gifts"];
    case "Home & Living": return ["Home & Living"];
    // Preserve support for older internal-value query strings/bookmarks.
    case "Apparel": return ["Apparel"];
    case "Books": return ["Books"];
    case "Bookmarks": return ["Bookmarks"];
    case "Arts":
    case "Art": return ["Arts", "Art"];
    default: return [category];
  }
}
