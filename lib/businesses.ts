export const categories = ["Fashion", "Beauty", "Food & Drink", "Events", "Music", "Services", "Art & Creators", "Christian Brands"] as const;
export type Category = typeof categories[number];
export type ListingStatus = "pending" | "approved" | "rejected";

export type Business = {
  id: string;
  owner_id: string;
  name: string;
  category: Category;
  location: string;
  summary: string;
  description: string;
  website_url: string;
  status: ListingStatus;
  created_at: string;
  updated_at: string;
};

export type BusinessValues = Pick<Business, "name" | "category" | "location" | "summary" | "description" | "website_url">;
export type BusinessFormState = { error?: string; values?: Partial<BusinessValues> };
export const businessFields = "id, owner_id, name, category, location, summary, description, website_url, status, created_at, updated_at";

export function publicWebsite(input: string): string | null {
  try {
    const url = new URL(input);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    if (!url.hostname.includes(".") || url.hostname === "localhost" || url.hostname.endsWith(".local")) return null;
    return url.href;
  } catch { return null; }
}

export function validateBusiness(form: FormData): BusinessFormState & { data?: BusinessValues } {
  const read = (key: string) => typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
  const values = { name: read("name"), category: read("category") as Category, location: read("location"), summary: read("summary"), description: read("description"), website_url: read("website_url") };
  const fail = (error: string) => ({ error, values });
  if (values.name.length < 2 || values.name.length > 100) return fail("Use a business name between 2 and 100 characters.");
  if (!categories.includes(values.category)) return fail("Choose a category.");
  if (values.location.length < 2 || values.location.length > 100) return fail("Add a location or write Online (2–100 characters).");
  if (values.summary.length < 10 || values.summary.length > 180) return fail("Write a short introduction between 10 and 180 characters.");
  if (values.description.length < 30 || values.description.length > 3000) return fail("Tell us about your business in 30–3,000 characters.");
  const website = publicWebsite(values.website_url);
  if (!website || website.length > 500) return fail("Add a valid public website or social profile, starting with https://.");
  if (form.get("faith_confirmed") !== "yes") return fail("Please confirm your business is Christian-owned or faith-led.");
  return { data: { ...values, website_url: website }, values };
}

export function searchTerm(value: unknown) {
  // Prevent PostgREST filter operators and SQL wildcard patterns in search input.
  return (typeof value === "string" ? value : "").trim().slice(0, 80).replace(/[^\p{L}\p{N} '&-]/gu, " ").replace(/\s+/g, " ").trim();
}

export function pageNumber(value: unknown) {
  const number = typeof value === "string" ? Number(value) : 1;
  return Number.isSafeInteger(number) && number > 0 ? Math.min(number, 1000) : 1;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
