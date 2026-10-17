import { withProductCover } from "@/lib/product-images";
import { productCategoryLabel } from "@/lib/product-categories";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { VerseOfTheDay } from "@/components/verse-of-the-day";
import { FavouriteButton } from "@/components/favourite-button";
import { MarketingSignupShell } from "@/components/marketing-signup-shell";
import { getFavouriteIds } from "@/lib/favourites";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, price, image_url, category_type, product_images(image_url, sort_order), lister_storefronts(business_name)")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(4);

  const realProducts = (products ?? []).map(withProductCover);
  const favouriteIds = await getFavouriteIds(supabase, user?.id);

  return (
    <div className="home-page">
      <section className="home-hero-layout">
        {productsError && <p role="alert" className="notice notice-error">Featured products could not be loaded. Refresh or visit the marketplace to try again.</p>}
        <div className="home-intro-panel">
          <div className="home-hero-copy">
          <p className="eyebrow">HolyHub</p>
          <h1>Connect. Discover. <span>Grow.</span></h1>
          <p className="lead">
            Discover thoughtful products from Christian brands and independent creators.
          </p>
          <div className="button-row">
            <Link className="button button-primary button-large" href="/marketplace">Explore Marketplace <span aria-hidden="true">→</span></Link>
          </div>
          </div>
        </div>
        <div className="home-verse-panel"><VerseOfTheDay hero /></div>
      </section>

      {realProducts.length > 0 && <section className="home-products" aria-labelledby="home-products-title">
        <div className="section-heading section-heading-split">
          <div>
            <p className="eyebrow">Marketplace</p>
            <h2 id="home-products-title">Made to be discovered.</h2>
          </div>
          <Link className="section-link inline-section-link" href="/marketplace">See all products <span aria-hidden="true">→</span></Link>
        </div>

        <div className="home-product-grid">
          {realProducts.map((product) => {
            const storefront = Array.isArray(product.lister_storefronts) ? product.lister_storefronts[0] : product.lister_storefronts;
            return (
              <article className="home-product-card" key={product.id}>
                <div className="home-product-media">
                  <Link href={`/products/${product.id}`}>
                    <div className="home-product-image">
                      {product.image_url ? <Image src={product.image_url} alt={product.name} width={600} height={600} unoptimized /> : <div className="product-placeholder">HolyHub</div>}
                      <span>{productCategoryLabel(product.category_type)}</span>
                    </div>
                  </Link>
                  <FavouriteButton productId={product.id} initialSaved={favouriteIds.has(product.id)} />
                </div>
                <Link href={`/products/${product.id}`}>
                <div className="home-product-copy">
                  {storefront?.business_name && <small>{storefront.business_name}</small>}
                  <h3>{product.name}</h3>
                  <strong>£{Number(product.price).toFixed(2)}</strong>
                </div>
                </Link>
              </article>
            );
          })}
        </div>
      </section>}

      <MarketingSignupShell source="homepage_signup" />

      <section className="home-cta">
        <div>
          <p className="eyebrow">Find your favourites</p>
          <h2>Discover more in one place.</h2>
          <p>Find Christian brands, products and creators you might not have found otherwise.</p>
        </div>
        <Link className="button button-primary button-large" href="/auth/signup">Join HolyHub <span aria-hidden="true">→</span></Link>
      </section>
    </div>
  );
}
