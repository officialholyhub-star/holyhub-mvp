import { ErrorRecovery } from "@/components/error-recovery";
import { requireRole } from "@/lib/auth/require-user";
import { saveStorefront } from "@/app/lister/storefront/actions";
import { StorefrontForm } from "@/components/storefront-form";

export const dynamic = "force-dynamic";

export default async function StorefrontPage({ searchParams }: { searchParams: Promise<{ onboarding?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireRole("lister");
  const { data: storefront, error } = await supabase.from("lister_storefronts").select("business_name, description, category_type, website_url, instagram_url, logo_url, delivery_option, delivery_charge, dispatch_window, dispatch_custom_timeframe").eq("user_id", user.id).maybeSingle();

  if (error) return <ErrorRecovery title="We couldn’t load these details" message="Please refresh before editing or continuing. Your saved details could not be checked." href="/lister" label="Return to dashboard" />;
  return (
    <section className="auth-wrap">
      <div className="card">
        <div className="card-header">
          <p className="eyebrow">Your storefront</p>
          <h2>{storefront ? "Storefront details" : "Set up your shop"}</h2>
          <p>{storefront ? "This information is shown with your published products." : "Add your shop name, description and delivery details before listing your first product."}</p>
        </div>
        <StorefrontForm action={saveStorefront} userId={user.id} storefront={storefront} onboarding={params.onboarding === "1"} />
      </div>
    </section>
  );
}