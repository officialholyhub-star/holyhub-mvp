import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { saveStorefront } from "@/app/lister/actions";

export const dynamic = "force-dynamic";

export default async function StorefrontPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireRole("lister");
  const { data: storefront } = await supabase.from("lister_storefronts").select("business_name, description, category_type, website_or_social, delivery_option, delivery_charge").eq("user_id", user.id).maybeSingle();

  return (
    <section className="auth-wrap">
      <div className="card">
        <div className="card-header">
          <p className="eyebrow">Your storefront</p>
          <h2>Storefront details</h2>
          <p>This information is shown with your published products.</p>
        </div>
        {params.error && <p className="notice notice-error">{params.error}</p>}
        {params.message && <p className="notice notice-success">{params.message}</p>}
        <form className="form" action={saveStorefront}>
          <div className="field">
            <label htmlFor="business_name">Business/brand name</label>
            <input id="business_name" name="business_name" type="text" defaultValue={storefront?.business_name ?? ""} maxLength={150} required />
          </div>
          <div className="field">
            <label htmlFor="description">Business description</label>
            <textarea id="description" name="description" defaultValue={storefront?.description ?? ""} maxLength={500} rows={4} required />
          </div>
          <div className="field">
            <label htmlFor="category_type">Business category</label>
            <input id="category_type" name="category_type" type="text" defaultValue={storefront?.category_type ?? ""} maxLength={100} required />
          </div>
          <div className="field">
            <label htmlFor="website_or_social">Website or social media link <span className="muted-small">(optional)</span></label>
            <input id="website_or_social" name="website_or_social" type="url" defaultValue={storefront?.website_or_social ?? ""} maxLength={500} placeholder="https://" />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="delivery_option">Delivery option</label>
              <select id="delivery_option" name="delivery_option" defaultValue={storefront?.delivery_option ?? "free"}>
                <option value="free">Free delivery</option>
                <option value="flat">Flat delivery fee</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="delivery_charge">Delivery charge (GBP)</label>
              <input id="delivery_charge" name="delivery_charge" type="number" min="0" step="0.01" defaultValue={storefront?.delivery_charge ?? 0} />
            </div>
          </div>
          <button className="button button-primary" type="submit">Save storefront</button>
        </form>
        <Link className="button button-quiet form-back" href="/account">Back to account</Link>
      </div>
    </section>
  );
}