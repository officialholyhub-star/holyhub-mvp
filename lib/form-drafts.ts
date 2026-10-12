// Only non-secret editable fields are saved, in this browser tab, for one day.
export const DRAFT_MAX_AGE = 24 * 60 * 60 * 1000;
export function editableDraft(data: FormData) {
  const values: Record<string, string[]> = {};
  for (const [key, value] of data) {
    if (typeof value !== "string" || /password|token|secret|terms|confirmed|confirmation|^\$ACTION|^next$|^intent$|^expected_status$|^.*_id$|^.*_version$|^publication_action$/.test(key)) continue;
    (values[key] ??= []).push(value);
  }
  return values;
}
export function readDraft(key: string): Record<string, string[]> | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || "null");
    // Preserve first-product drafts saved by the previous guided form.
    if (!saved && key.startsWith("hh-product-draft-") && key.endsWith("-new")) {
      const legacy = JSON.parse(sessionStorage.getItem(key.slice(0, -4)) || "null");
      if (legacy && typeof legacy === "object") return Object.fromEntries(Object.entries(legacy)
        .filter(([field, value]) => /^(name|description|category_type|price|stock_quantity|size_guide_url|variant_(XS|S|M|L|XL|XXL)|gallery_present|image_url|image_urls|images)$/.test(field) && (typeof value === "string" || (Array.isArray(value) && value.every(item => typeof item === "string"))))
        .map(([field, value]) => [field, Array.isArray(value) ? value : [value as string]]));
    }
    if (!saved || typeof saved.at !== "number" || Date.now() - saved.at > DRAFT_MAX_AGE || !saved.values || typeof saved.values !== "object") return null;
    return Object.fromEntries(Object.entries(saved.values).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every(value => typeof value === "string")));
  } catch { return null; }
}
export function writeDraft(key: string, values: Record<string, string[]>) {
  try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), values })); } catch { /* The live form remains usable when storage is unavailable. */ }
}
