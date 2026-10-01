import { notFound } from "next/navigation";

// Church profiles are parked until migration 013 and onboarding are enabled.
// Keep the future page/action implementation, but stop before any schema access.
export function requireChurchProfilesEnabled() {
  notFound();
}
