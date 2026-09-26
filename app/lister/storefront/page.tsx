import { requireRole } from "@/lib/auth/require-user";
import { saveStorefront } from "@/app/lister/actions";
import { StorefrontForm } from "@/components/storefront-form";

export const dynamic = "force-dynamic";

export default async function StorefrontPage() {
  const { supabase, user } = await requireRole("lister");
  const { data: storefront } = await supabase.from("lister_storefronts").select("business_name, description, category_type, website_url, instagram_url, logo_url, delivery_option, delivery_charge").eq("user_id", user.id).maybeSingle();

  return (
    <section className="auth-wrap">
      <div className="card">
        <div className="card-header">
          <p className="eyebrow">Your storefront</p>
          <h2>Storefront details</h2>
          <p>This information is shown with your published products.</p>
        </div>
        <StorefrontForm action={saveStorefront} userId={user.id} storefront={storefront} />
      </div>
    </section>
  );
}