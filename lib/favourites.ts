import type { SupabaseClient } from "@supabase/supabase-js";

export async function getFavouriteIds(supabase: SupabaseClient, userId?: string) {
  if (!userId) return new Set<string>();
  const { data } = await supabase.from("favourites").select("product_id").eq("user_id", userId);
  return new Set((data ?? []).map(({ product_id }) => product_id));
}
