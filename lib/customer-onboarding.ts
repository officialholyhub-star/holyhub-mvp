// Store participation flags only, never answers, names, email or consent.
export type SetupProgress = { interests: boolean; faith: boolean; dismissed?: boolean };
export const setupKey = (userId: string) => `hh-customer-setup-v1:${userId}`;
export function readSetup(userId: string): SetupProgress {
  try {
    const value = JSON.parse(sessionStorage.getItem(setupKey(userId)) || "{}");
    return { interests: value?.interests === true, faith: value?.faith === true, dismissed: value?.dismissed === true };
  } catch { return { interests: false, faith: false }; }
}
export function writeSetup(userId: string, value: SetupProgress) {
  try { sessionStorage.setItem(setupKey(userId), JSON.stringify(value)); } catch { /* Optional setup must work with storage disabled. */ }
}
export function firstIncomplete(value: SetupProgress) { return !value.interests ? 1 : !value.faith ? 2 : null; }

// Stable future preference IDs. Memory only today; no persistence adapter exists.
// Proposed owner-scoped customer_preferences record is documented in docs/customer-onboarding-2026-10-14.md.
export const interestDefinitions = [
  { id: "discover_brands", label: "Discover Christian brands", emphasis: ["marketplace"] },
  { id: "support_businesses", label: "Support Christian businesses", emphasis: ["marketplace", "new_brands"] },
  { id: "events", label: "Find Christian events", emphasis: ["events"] },
  { id: "community", label: "Find community", emphasis: ["community"] },
  { id: "organisations", label: "Discover churches & organisations", emphasis: ["organisations"] },
  { id: "opportunities", label: "Find opportunities / volunteering", emphasis: ["opportunities"] },
  { id: "faith_growth", label: "Grow in my faith", emphasis: ["faith", "bible", "community"] },
  { id: "explore", label: "Just explore", emphasis: ["balanced"] },
] as const;
export type InterestId = typeof interestDefinitions[number]["id"];
export type CustomerInterestPreferences = { version: 1; interestIds: InterestId[] };
export const interestOptions = interestDefinitions.map(interest => interest.label);
// Mapping is design metadata only. Never gate platform access or use faith-journey answers.
