import { ListingStage } from "@/components/listing-stage";
import { ClearDraft } from "@/components/draft-form";
import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { deleteProduct } from "@/app/lister/actions";
import { HelpIcon } from "@/components/help-icon";
import { LISTING_HELP, LISTING_STATUS_LABELS } from "@/lib/help-copy";
import { decodeDisplayText } from "@/lib/display-text";

export const dynamic = "force-dynamic";

export default async function ListerProductsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; saved?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireRole("lister");
  const [{ data: products, error: productsError }, { count: productCount, error: countError }] = await Promise.all([
    supabase.from("products").select("id, name, category_type, price, stock_quantity, is_published, review_status, review_reason, created_at").eq("lister_user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("lister_user_id", user.id),
  ]);

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Your catalogue</p>
          <h2>Products</h2>
        </div>
        <div className="row-actions">
          <Link className="button button-quiet" href="/lister/storefront">Back to storefront</Link>
          <Link className="button button-primary" href="/lister/products/new">Add product</Link>
          <Link className="button button-secondary" href="/lister/products/bulk">Bulk upload</Link>
        </div>
      </div>
      {params.error && <p className="notice notice-error">{params.error}</p>}
      {params.saved && <ClearDraft draftKey={`hh-product-draft-${user.id}-${params.saved}`} />}
      {params.message && <p className="notice notice-success">{params.message}</p>}
      {countError || productCount == null ? <p role="alert">Listing count unavailable. Refresh to try again.</p> : <p className="notice notice-info">{(productCount ?? 0) < 10 ? `${productCount ?? 0} of your 10 free listings used · ${10 - (productCount ?? 0)} remaining.` : productCount === 10 ? "Your 10 free listings are used." : `Your first 10 listings are free; ${(productCount ?? 0) - 10} ${(productCount ?? 0) - 10 === 1 ? "listing is" : "listings are"} beyond your free allowance.`} Additional listings are £0.20 each; billing is not enabled in this stage.</p>}
      {productsError ? <p className="notice notice-error" role="alert">Your products could not be loaded. Please refresh to try again.</p> : products?.length ? (
        <div className="product-list">
          <ListingStage products={products} />
          {products.map((product) => (
            <article className="product-row" key={product.id}>
              <div>
                <h3>{decodeDisplayText(product.name)}</h3>
                <p className="muted-small">{product.category_type} · £{Number(product.price).toFixed(2)} · Stock: {product.stock_quantity}</p>
                <span className="status-with-help"><span className={`status-pill status-${product.review_status}`}>{LISTING_STATUS_LABELS[product.review_status as keyof typeof LISTING_STATUS_LABELS] ?? product.review_status}</span><HelpIcon label={LISTING_STATUS_LABELS[product.review_status as keyof typeof LISTING_STATUS_LABELS] ?? product.review_status} text={LISTING_HELP[product.review_status as keyof typeof LISTING_HELP] ?? "Check your listing’s review status."} /></span>
                {!product.is_published && product.review_status === "approved" && <p className="muted-small">Hidden from the marketplace</p>}
                {product.review_status === "rejected" && product.review_reason && <p className="review-reason">{product.review_reason}</p>}
              </div>
              <div className="row-actions">
                <Link className="button button-quiet" href={`/lister/products/${product.id}/edit`}>Edit</Link>
                <form action={deleteProduct}>
                  <input type="hidden" name="product_id" value={product.id} />
                  <button className="button button-secondary" type="submit">Delete</button>
                </form>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card empty-state"><p>You haven&apos;t created any listings yet.</p><Link className="button button-primary" href="/lister/products/new">Create your first listing</Link></div>
      )}
    </section>
  );
}
