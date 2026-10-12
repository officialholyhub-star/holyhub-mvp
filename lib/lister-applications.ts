import type { SupabaseClient } from "@supabase/supabase-js";

export type ListerApplication = {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  website_or_social: string;
  description: string;
  category_type: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

const APPLICATION_FIELDS = "id, business_name, contact_name, email, website_or_social, description, category_type, status, rejection_reason, created_at, updated_at";

// Prefer the single active application over historical rejected submissions.
// Always use the authenticated client and the user returned by requireUser.
export async function getListerApplication(supabase: SupabaseClient, userId: string) {
  const active = await supabase.from("lister_applications").select(APPLICATION_FIELDS)
    .eq("user_id", userId).in("status", ["pending", "approved"]).maybeSingle();
  if (active.error || active.data) return { application: active.data as ListerApplication | null, error: active.error };
  const rejected = await supabase.from("lister_applications").select(APPLICATION_FIELDS)
    .eq("user_id", userId).eq("status", "rejected")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  return { application: rejected.data as ListerApplication | null, error: rejected.error };
}
