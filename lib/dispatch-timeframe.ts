export const DISPATCH_WINDOWS = [
  "1-2-working-days",
  "2-3-working-days",
  "3-5-working-days",
  "5-7-working-days",
  "made-to-order",
] as const;

export type DispatchWindow = (typeof DISPATCH_WINDOWS)[number];

export const DISPATCH_WINDOW_LABELS: Record<DispatchWindow, string> = {
  "1-2-working-days": "Dispatch within 1–2 working days",
  "2-3-working-days": "Dispatch within 2–3 working days",
  "3-5-working-days": "Dispatch within 3–5 working days",
  "5-7-working-days": "Dispatch within 5–7 working days",
  "made-to-order": "Made to order / longer dispatch",
};

export function isDispatchWindow(value: string): value is DispatchWindow {
  return DISPATCH_WINDOWS.includes(value as DispatchWindow);
}

export function dispatchTerms(window: string | null | undefined, custom: string | null | undefined) {
  if (!window || !isDispatchWindow(window)) return null;
  if (window === "made-to-order") {
    const detail = custom?.trim() ?? "";
    return detail ? `Made to order — ${detail}` : null;
  }
  return DISPATCH_WINDOW_LABELS[window];
}

export function dispatchValidationError(window: string, custom: string) {
  if (!isDispatchWindow(window)) return "Choose a dispatch timeframe.";
  if (window === "made-to-order") {
    const detail = custom.trim();
    if (!detail || detail.length > 120) return "Enter the approved made-to-order dispatch timeframe (up to 120 characters).";
  } else if (custom.trim()) {
    return "Remove the made-to-order detail unless you choose made to order / longer dispatch.";
  }
  return null;
}
