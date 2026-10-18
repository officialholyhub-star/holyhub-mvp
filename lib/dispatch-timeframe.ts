export const LEGACY_DISPATCH_WINDOWS = [
  "1-2-working-days",
  "2-3-working-days",
  "3-5-working-days",
  "5-7-working-days",
] as const;

export const DISPATCH_WINDOWS = [
  ...LEGACY_DISPATCH_WINDOWS,
  "working-days",
  "made-to-order",
] as const;

export type DispatchWindow = (typeof DISPATCH_WINDOWS)[number];

export const DISPATCH_WINDOW_LABELS: Record<DispatchWindow, string> = {
  "1-2-working-days": "Dispatch within 1–2 working days",
  "2-3-working-days": "Dispatch within 2–3 working days",
  "3-5-working-days": "Dispatch within 3–5 working days",
  "5-7-working-days": "Dispatch within 5–7 working days",
  "working-days": "Choose my number of working days",
  "made-to-order": "Made to order / longer dispatch",
};

export function isDispatchWindow(value: string): value is DispatchWindow {
  return DISPATCH_WINDOWS.includes(value as DispatchWindow);
}

export function isLegacyDispatchWindow(value: string): value is (typeof LEGACY_DISPATCH_WINDOWS)[number] {
  return LEGACY_DISPATCH_WINDOWS.includes(value as (typeof LEGACY_DISPATCH_WINDOWS)[number]);
}

function workingDaysValue(custom: string | null | undefined) {
  const value = custom?.trim() ?? "";
  if (!/^([1-9]|[12][0-9]|30)$/.test(value)) return null;
  return Number(value);
}

export function dispatchTerms(window: string | null | undefined, custom: string | null | undefined) {
  if (!window || !isDispatchWindow(window)) return null;
  if (window === "working-days") {
    const days = workingDaysValue(custom);
    if (days === null) return null;
    return `Dispatch within ${days} working ${days === 1 ? "day" : "days"}`;
  }
  if (window === "made-to-order") {
    const detail = custom?.trim() ?? "";
    return detail ? `Made to order — ${detail}` : null;
  }
  return DISPATCH_WINDOW_LABELS[window];
}

export function dispatchValidationError(window: string, custom: string) {
  if (!isDispatchWindow(window)) return "Choose a dispatch timeframe.";
  if (window === "working-days") {
    if (workingDaysValue(custom) === null) return "Choose a whole number from 1 to 30 working days.";
  } else if (window === "made-to-order") {
    const detail = custom.trim();
    if (!detail || detail.length > 120) return "Enter the made-to-order dispatch timeframe (up to 120 characters).";
  } else if (custom.trim()) {
    return "Remove the custom dispatch detail unless you choose your own working days or made to order / longer dispatch.";
  }
  return null;
}
