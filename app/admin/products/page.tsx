import { reviewProductListing } from "../actions";
import { requireRole } from "@/lib/auth/require-user";

/* Lister image URLs are user-provided and not restricted to configured hosts. */
/* eslint-disable @next/next/no-img-element */

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const { supabase } = await requireRole("admin");
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, description, category_type, price, image_url, lister_user_id, review_status, created_at")
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
          {products.map((product) => (
            <article className="review-card product-review-card" key={product.id}>
              <div className="product-review-layout">
                {product.image_url ? <img className="product-review-image" src={product.image_url} alt={product.name} /> : <div className="product-review-image product-placeholder" aria-label="No product image">No image</div>}
                <div className="product-review-content">
                  <div className="review-card-header">
                    <div>
                      <p className="eyebrow">{storefrontNames.get(product.lister_user_id) ?? "HolyHub lister"} · {product.category_type}</p>
                      <h2>{product.name}</h2>
                      <p className="muted-small">Submitted {new Date(product.created_at).toLocaleDateString("en-GB")} · £{Number(product.price).toFixed(2)}</p>
                    </div>
                    <span className="status-pill status-pending">{product.review_status}</span>
                  </div>
                  <p className="review-description">{product.description}</p>
                  <div className="review-actions">
                    <form action={reviewProductListing} className="review-reject-form">
                      <input type="hidden" name="product_id" value={product.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <label className="sr-only" htmlFor={`listing-reason-${product.id}`}>Reason for requesting changes</label>
                      <input id={`listing-reason-${product.id}`} name="review_reason" placeholder="Reason for changes (required)" maxLength={1000} required />
                      <button className="button button-secondary" type="submit">Reject / request changes</button>
                    </form>
                    <form action={reviewProductListing}>
                      <input type="hidden" name="product_id" value={product.id} />
                      <input type="hidden" name="decision" value="approve" />
                      <button className="button button-primary" type="submit">Approve listing</button>
                    </form>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card empty-state admin-empty-state"><h2>No product listings are waiting for review.</h2><p>New submissions will appear here when listers publish them.</p></div>
      )}
    </section>
  );
}