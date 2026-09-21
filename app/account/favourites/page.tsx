import Image from "next/image";
import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { FavouriteButton } from "@/components/favourite-button";

export const dynamic = "force-dynamic";

export default async function FavouritesPage() {
  const { supabase, user } = await requireUser();
  const { data: favourites } = await supabase
    .from("favourites")
    .select("created_at, products(id, name, price, image_url, category_type, lister_storefronts(business_name))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const products = (favourites ?? [])
    .map(({ products: product }) => Array.isArray(product) ? product[0] : product)
    .filter((product): product is NonNullable<typeof product> => Boolean(product));

  return (
    <section className="favourites-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Your HolyHub space</p>
          <h1>Favourites</h1>
          <p className="lead">The products and brands you want to remember.</p>
        </div>
        <Link className="button button-primary" href="/marketplace">Explore Marketplace</Link>
      </div>

      {products.length ? (
        <div className="product-grid marketplace-grid">
          {products.map((product) => {
            const storefront = Array.isArray(product.lister_storefronts) ? product.lister_storefronts[0] : product.lister_storefronts;
            return (
              <article className="product-card marketplace-card" key={product.id}>
                <div className="marketplace-card-media">
                  <Link href={`/products/${product.id}`}>
                    <div className="marketplace-card-image">
                      {product.image_url ? <Image src={product.image_url} alt={product.name} width={600} height={600} unoptimized /> : <div className="product-placeholder" aria-hidden="true">HolyHub</div>}
                      <span>{product.category_type}</span>
                    </div>
                  </Link>
                  <FavouriteButton productId={product.id} initialSaved />
                </div>
                <Link href={`/products/${product.id}`}>
                  <div className="product-card-body">
                    <p className="marketplace-lister">{storefront?.business_name ?? "HolyHub lister"}</p>
                    <h3>{product.name}</h3>
                    <strong>£{Number(product.price).toFixed(2)}</strong>
                  </div>
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="favourites-empty">
          <span className="favourites-empty-heart" aria-hidden="true">♡</span>
          <h2>You haven&apos;t saved anything yet.</h2>
          <p>Keep the pieces you love close by saving them as you browse.</p>
          <Link className="button button-primary" href="/marketplace">Explore Marketplace</Link>
        </div>
      )}
    </section>
  );
}