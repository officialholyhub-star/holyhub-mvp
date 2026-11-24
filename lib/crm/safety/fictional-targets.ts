/** Synthetic-only record checks. These labels are not a real-person authentication mechanism. */
export function isFictionalContactName(name: string): boolean {
  return /^(?:example|synthetic|test)(?:\s|\s*[-:])/i.test(name.trim()) ||
    /\s(?:example|sample)$/i.test(name.trim());
}
export function isSyntheticOrigin(source: string): boolean {
  return source === "synthetic" || source.startsWith("synthetic_") || source.startsWith("n18_synthetic_");
}
export function isFictionalOrganisationKey(key: string): boolean {
  return /(?:^|\.)(?:example|test|invalid)$/i.test(key.trim());
}
