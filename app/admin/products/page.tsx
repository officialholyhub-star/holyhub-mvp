import { readAllRows } from "@/lib/read-all-rows";
import Link from "next/link";
import { ClearDraft } from "@/components/draft-form";
import { requireRole } from "@/lib/auth/require-user";
import { AdminProductReviewCard } from "@/components/admin-product-review-card";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; product?: string; reviewed?: string; status?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireRole("admin");
  let query = supabase
    .from("products")
    .select("id, name, description, category_type, price, image_url, size_guide_url, lister_user_id, review_status, review_reason, created_at, updated_at, product_images(image_url, sort_order), product_review_snapshots(previous_name, previous_description, previous_category_type, previous_image_url, previous_size_guide_url, previous_gallery_images)")
    .order("created_at", { ascending: true }).order("id");
  if (params.product && /^[0-9a-f-]{36}$/i.test(params.product)) query = query.eq("id", params.product);
  else query = query.eq("review_status", params.status === "rejected" ? "rejected" : "pending");
  const { data: products, error } = await readAllRows(offset => query.range(offset, offset + 999));
  const listerIds = products?.map(({ lister_user_id }) => lister_user_id) ?? [];
  const { data: storefronts, error: storefrontsError } = listerIds.length
    ? await supabase.from("lister_storefronts").select("user_id, business_name").in("user_id", listerIds)
    : { data: [] };
  const storefrontNames = new Map((storefronts ?? []).map(({ user_id, business_name }) => [user_id, business_name]));

  return (
    <section className="admin-workspace admin-products-page">
      <div className="admin-page-heading">
        <div>
          <p className="eyebrow">Admin workspace</p>
          <h1>{params.product ? "Product details" : params.status === "rejected" ? "Returned products" : "Product listings"}</h1>
          <p className="lead">{params.product ? "Inspect this listing and its existing review status." : params.status === "rejected" ? "Saved feedback for products needing lister changes." : "Review the next marketplace submission and keep decisions consistent."}</p>
        </div>
        {!params.product && <span className="review-count">{error ? "Count unavailable" : `${products?.length ?? 0} ${params.status === "rejected" ? "returned for changes" : "waiting"}`}</span>}
      </div>
      <nav className="admin-tabs" aria-label="Admin workspace"><a href="/admin/orders">Orders</a>
        <a href="/admin">Overview</a>
        <a href="/admin/applications">Lister Applications</a>
        <a href="/admin/listers">Listers</a>
        <a className="is-active" href="/admin/products" aria-current="page">Product Listings</a>
        <span className="admin-tab-disabled">Refunds <span>Coming soon</span></span>
      </nav>
      {params.error && <p className="notice notice-error" role="alert">{params.error}</p>}
      {params.reviewed && <ClearDraft draftKey={`hh-review-product-${user.id}-${params.reviewed}`} />}
      {params.message && <p className="notice notice-success" role="status">{params.message}</p>}
      {storefrontsError && <p className="notice notice-error" role="alert">Shop details could not be loaded. Refresh to try again before reviewing this listing.</p>}
      {error ? (
        <div className="marketplace-status marketplace-status-error"><strong>Listings could not be loaded</strong><p>Please try again.</p></div>
      ) : storefrontsError ? null : products?.length ? (
        <div className="review-list">
          {products.map((product) => {
            const snapshot = Array.isArray(product.product_review_snapshots) ? product.product_review_snapshots[0] : product.product_review_snapshots;
            return <AdminProductReviewCard draftOwner={user.id} key={product.id} storefrontName={storefrontNames.get(product.lister_user_id) ?? "HolyHub lister"} readOnly={product.review_status !== "pending"} product={{ ...product, review_snapshot: snapshot ?? null }} />;
          })}
        </div>
      ) : (
        <div className="card empty-state admin-empty-state"><h2>{params.product ? "This listing is no longer available." : params.status === "rejected" ? "No products are currently returned for changes." : "No product listings are waiting for review."}</h2>{params.product ? <Link className="button button-primary" href="/admin/products">Return to product review queue</Link> : params.status === "rejected" ? <Link href="/admin/products">View products awaiting review</Link> : <p>New submissions will appear here when listers submit them for review.</p>}</div>
      )}
    </section>
  );
}
