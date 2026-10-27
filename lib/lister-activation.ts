import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchTerms, dispatchValidationError } from "./dispatch-timeframe";

export type GateState = "complete" | "pending_review" | "action_required" | "waiting" | "error";
export type ActivationGate = { state: GateState; reason?: "missing" | "rejected" | "invalid"; detail?: string };
export type CurrentListerTerms = { version: string; content_sha256: string };
export type ListerActivation = {
  identity: ActivationGate;
  dispatch: ActivationGate;
  terms: ActivationGate;
  ready: boolean;
};
type ActivationInput = {
  identity?: { verification_status: string; verification_note?: string | null } | null;
  storefront?: { dispatch_window?: string | null; dispatch_custom_timeframe?: string | null } | null;
  currentTerms?: CurrentListerTerms | null;
  acceptedCurrent?: boolean | null;
  errors?: { identity?: boolean; dispatch?: boolean; terms?: boolean };
};

/** Presentation state only: never authorizes a sale or replaces database gates. */
export function listerActivationStatus(input: ActivationInput): ListerActivation {
  const identity: ActivationGate = input.errors?.identity ? { state: "error" }
    : input.identity?.verification_status === "verified" ? { state: "complete" }
    : input.identity?.verification_status === "pending" ? { state: "pending_review" }
    : { state: "action_required", reason: input.identity?.verification_status === "rejected" ? "rejected" : "missing",
      detail: input.identity?.verification_status === "rejected" ? input.identity.verification_note ?? undefined : undefined };
  const window = input.storefront?.dispatch_window ?? "";
  const custom = input.storefront?.dispatch_custom_timeframe ?? "";
  const dispatch: ActivationGate = input.errors?.dispatch ? { state: "error" }
    : !window ? { state: "action_required", reason: "missing" }
    : dispatchValidationError(window, custom) ? { state: "action_required", reason: "invalid" }
    : { state: "complete", detail: dispatchTerms(window, custom) ?? undefined };
  const terms: ActivationGate = input.errors?.terms ? { state: "error" }
    : !input.currentTerms ? { state: "waiting" }
    : input.acceptedCurrent === true ? { state: "complete", detail: input.currentTerms.version }
    : input.acceptedCurrent === false ? { state: "action_required", detail: input.currentTerms.version }
    : { state: "error" };
  return { identity, dispatch, terms, ready: [identity, dispatch, terms].every(gate => gate.state === "complete") };
}

/** All callers use the same database readiness facts and fail closed on read errors. */
export async function loadListerActivation(supabase: SupabaseClient, userId: string): Promise<ListerActivation> {
  const [identity, storefront, current, accepted] = await Promise.all([
    supabase.from("seller_legal_profiles").select("verification_status, verification_note").eq("user_id", userId).maybeSingle(),
    supabase.from("lister_storefronts").select("dispatch_window, dispatch_custom_timeframe").eq("user_id", userId).maybeSingle(),
    supabase.rpc("get_current_lister_terms"),
    supabase.rpc("seller_terms_are_current", { p_user_id: userId }),
  ]);
  const currentTerms = Array.isArray(current.data) ? current.data[0] ?? null : null;
  return listerActivationStatus({ identity: identity.data, storefront: storefront.data, currentTerms,
    acceptedCurrent: typeof accepted.data === "boolean" ? accepted.data : null,
    errors: { identity: Boolean(identity.error), dispatch: Boolean(storefront.error),
      terms: Boolean(current.error || accepted.error) || !Array.isArray(current.data) } });
}
