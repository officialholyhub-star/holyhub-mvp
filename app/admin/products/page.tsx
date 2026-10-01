import { requireRole } from "@/lib/auth/require-user";
import { AdminProductReviewCard } from "@/components/admin-product-review-card";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const { supabase } = await requireRole("admin");
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, description, category_type, price, image_url, size_guide_url, lister_user_id, review_status, created_at, product_review_snapshots(previous_name, previous_description, previous_category_type, previous_image_url, previous_size_guide_url)")
    .eq("review_status", "pending")
    .order("created_at", { ascending: true });
  const listerIds = products?.map(({ lister_user_id }) => lister_user_id) ?? [];
  const { data: storefronts } = listerIds.length
    ? await supabase.from("lister_storefronts").select("user_id, business_name").in("user_id", listerIds)
    : { data: [] };
  const storefrontNames = new Map((storefronts ?? []).map(({ user_id, business_name }) => [user_id, business_name]));

  return (
    <section className="admin-workspace admin-products-page">
      <div className="admin-page-heading">
        <div>
          <p className="eyebrow">Admin workspace</p>
          <h1>Product listings</h1>
          <p className="lead">Review the next marketplace submission and keep decisions consistent.</p>
        </div>
        <span className="review-count" aria-label={`${products?.length ?? 0} product listings awaiting review`}>{products?.length ?? 0} waiting</span>
      </div>
      <nav className="admin-tabs" aria-label="Admin workspace">
        <a href="/admin">Overview</a>
        <a href="/admin/applications">Lister Applications</a>
        <a className="is-active" href="/admin/products" aria-current="page">Product Listings</a>
        <span className="admin-tab-disabled">Refunds <span>Coming soon</span></span>
      </nav>
      {params.error && <p className="notice notice-error" role="alert">{params.error}</p>}
      {params.message && <p className="notice notice-success" role="status">{params.message}</p>}
      {error ? (
        <div className="marketplace-status marketplace-status-error"><strong>Listings could not be loaded</strong><p>Please try again.</p></div>
      ) : products?.length ? (
        <div className="review-list">
          {products.map((product) => {
            const snapshot = Array.isArray(product.product_review_snapshots) ? product.product_review_snapshots[0] : product.product_review_snapshots;
            return <AdminProductReviewCard key={product.id} storefrontName={storefrontNames.get(product.lister_user_id) ?? "HolyHub lister"} product={{ ...product, review_snapshot: snapshot ?? null }} />;
          })}
        </div>
      ) : (
        <div className="card empty-state admin-empty-state"><h2>No product listings are waiting for review.</h2><p>New submissions will appear here when listers publish them.</p></div>
      )}
    </section>
  );
}