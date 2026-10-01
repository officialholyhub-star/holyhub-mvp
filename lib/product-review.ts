export const REJECTION_PRESETS = [
  "Product image needs improvement",
  "Description needs more detail",
  "Wrong category",
  "Size or stock information is incomplete",
  "Product details are unclear",
  "Christian / brand relevance needs clarification",
  "Duplicate or incorrect listing",
  "Other",
] as const;

export type ReviewableProductFields = {
  name: string;
  description: string;
  category_type: string;
  image_url: string | null;
  size_guide_url: string | null;
  price?: number | string;
  stock_quantity?: number;
};

export function hasMaterialProductChange(previous: ReviewableProductFields, next: ReviewableProductFields) {
  return previous.name !== next.name
    || previous.description !== next.description
    || previous.category_type !== next.category_type
    || previous.image_url !== next.image_url
    || previous.size_guide_url !== next.size_guide_url;
}

export function combineReviewFeedback(presets: readonly string[], customNote: string) {
  const selected = REJECTION_PRESETS.filter((preset) => presets.includes(preset));
  const note = customNote.trim();
  const feedback = [...selected, ...(note ? [note] : [])].join("\n");
  return feedback.length > 0 && feedback.length <= 1000 ? feedback : null;
}
