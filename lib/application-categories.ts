import { isAllowedProductCategory } from "./product-categories";

export const OTHER_APPLICATION_CATEGORY = "__other__";
export const SUGGESTED_CATEGORY_PREFIX = "Other: ";
export const MAX_SUGGESTED_CATEGORY_LENGTH = 100 - SUGGESTED_CATEGORY_PREFIX.length;

// Suggestions use the existing application category field, keeping the schema intact.
export function applicationCategoryValue(category: string, suggestion: string, existingCategory?: string) {
  if (category === OTHER_APPLICATION_CATEGORY) {
    const text = suggestion.trim();
    return text && text.length <= MAX_SUGGESTED_CATEGORY_LENGTH && !/[\u0000-\u001f\u007f]/.test(text)
      ? `${SUGGESTED_CATEGORY_PREFIX}${text}` : null;
  }
  return isAllowedProductCategory(category, existingCategory) ? category : null;
}
