import type { SupabaseClient } from "@supabase/supabase-js";

export type FulfilmentSummary = {
  unfulfilled: number;
  processing: number;
  dispatched: number;
  completed: number;
  toFulfil: number;
};

// Use exact database counts so the summary is independent of list row limits.
// Call with the authenticated client and the user returned by requireRole.
export async function getSellerFulfilmentSummary(supabase: SupabaseClient, sellerUserId: string): Promise<FulfilmentSummary | null> {
  const results = await Promise.all(["pending", "packed", "dispatched", "delivered"].map((status) =>
    supabase.from("seller_orders")
      .select("id", { count: "exact", head: true })
      .eq("seller_user_id", sellerUserId)
      .eq("fulfilment_status", status)
  ));
  if (results.some((result) => result.error || result.count === null)) return null;
  const [unfulfilled, processing, dispatched, completed] = results.map((result) => result.count!);
  return { unfulfilled, processing, dispatched, completed, toFulfil: unfulfilled + processing };
}
