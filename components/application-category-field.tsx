"use client";

import { FormRecovery } from "@/components/draft-form";
import { readDraft } from "@/lib/form-drafts";
import { useState } from "react";
import { isProductCategory, PRODUCT_CATEGORIES } from "@/lib/product-categories";
import { MAX_SUGGESTED_CATEGORY_LENGTH, OTHER_APPLICATION_CATEGORY, SUGGESTED_CATEGORY_PREFIX } from "@/lib/application-categories";

export function ApplicationCategoryField({ savedCategory = "", draftKey }: { savedCategory?: string; draftKey?: string }) {
  const isSuggestion = savedCategory.startsWith(SUGGESTED_CATEGORY_PREFIX);
  const [category, setCategory] = useState(isSuggestion ? OTHER_APPLICATION_CATEGORY : savedCategory);
  const [suggestion, setSuggestion] = useState(isSuggestion ? savedCategory.slice(SUGGESTED_CATEGORY_PREFIX.length) : "");
  return <>
    <FormRecovery onSettled={() => { const draft = draftKey ? readDraft(draftKey) : null; if (draft?.category_type) setCategory(draft.category_type[0]); if (draft?.suggested_category) setSuggestion(draft.suggested_category[0]); }} />
    <div className="field">
      <label htmlFor="category_type">Product/category type</label>
      <select id="category_type" name="category_type" value={category} onChange={event => setCategory(event.currentTarget.value)} required>
        <option value="" disabled>Choose a category</option>
        {savedCategory && !isSuggestion && !isProductCategory(savedCategory) && <option value={savedCategory}>{savedCategory} (current category)</option>}
        {PRODUCT_CATEGORIES.map(option => <option key={option} value={option}>{option}</option>)}
        <option value={OTHER_APPLICATION_CATEGORY}>Other / Suggest another category</option>
      </select>
    </div>
    {category === OTHER_APPLICATION_CATEGORY && <div className="field">
      <label htmlFor="suggested_category">Suggested category</label>
      <input id="suggested_category" name="suggested_category" value={suggestion} onChange={event => setSuggestion(event.currentTarget.value)} maxLength={MAX_SUGGESTED_CATEGORY_LENGTH} required aria-describedby="suggested-category-help" placeholder="Tell us what you plan to sell" />
      <p id="suggested-category-help" className="muted-small form-help">We’ll review your suggestion with your application.</p>
    </div>}
  </>;
}
