import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { deleteProduct } from "@/app/lister/actions";

export const dynamic = "force-dynamic";

export default async function ListerProductsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireRole("lister");
  const [{ data: products }, { count: productCount }] = await Promise.all([
    supabase.from("products").select("id, name, category_type, price, is_published, created_at").eq("lister_user_id", user.id).order("created_at", { ascending: false }),
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
        </div>
      </div>
      {params.error && <p className="notice notice-error">{params.error}</p>}
      {params.message && <p className="notice notice-success">{params.message}</p>}
      <p className="notice notice-info">{productCount ?? 0} of your first 10 product listings are free. Additional listings are £0.20 each; billing is not enabled in this stage.</p>
      {products?.length ? (
        <div className="product-list">
          {products.map((product) => (
            <article className="product-row" key={product.id}>
              <div>
                <h3>{product.name}</h3>
                <p className="muted-small">{product.category_type} · £{Number(product.price).toFixed(2)} · {product.is_published ? "Published" : "Draft"}</p>
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
        <div className="card empty-state"><p>You have not added any products yet.</p><Link className="text-link" href="/lister/products/new">Add your first product</Link></div>
      )}
    </section>
  );
}