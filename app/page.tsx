import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { VerseOfTheDay } from "@/components/verse-of-the-day";
import { FavouriteButton } from "@/components/favourite-button";
import { demoProducts } from "@/lib/demo-products";
import { getFavouriteIds } from "@/lib/favourites";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, image_url, category_type, lister_storefronts(business_name)")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(4);

  const realProducts = products ?? [];
  const favouriteIds = await getFavouriteIds(supabase, user?.id);
  const demoSlots = Math.max(0, 4 - realProducts.length);
  const homepageDemoProducts = demoProducts.slice(0, demoSlots);

  return (
    <div className="home-page">
      <section className="home-hero home-hero-refresh premium-home-hero">
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

        <VerseOfTheDay hero />
      </section>

      <section className="home-community-note" aria-labelledby="home-community-title">
        <div className="home-community-image">
          <Image src="/images/community-lifestyle.jpg" alt="Friends gathering around a table" width={1200} height={1798} />
        </div>
        <div>
          <p className="eyebrow">Made for real life</p>
          <h2 id="home-community-title">Products with people behind them.</h2>
          <p>Discover pieces from Christian brands and independent creators who are building something meaningful.</p>
        </div>
      </section>

      <section className="home-products" aria-labelledby="home-products-title">
        <div className="section-heading section-heading-split">
          <div>
            <p className="eyebrow">Marketplace</p>
            <h2 id="home-products-title">Made to be discovered.</h2>
          </div>
          <Link className="section-link inline-section-link" href="/marketplace">See all products <span aria-hidden="true">→</span></Link>
        </div>

        {homepageDemoProducts.length > 0 && (
          <div className="demo-preview-banner">
            <strong>Marketplace preview</strong>
            <span>Demo products are filling the empty spaces so you can see the finished marketplace vibe.</span>
          </div>
        )}

        <div className="home-product-grid">
          {realProducts.map((product) => {
            const storefront = Array.isArray(product.lister_storefronts) ? product.lister_storefronts[0] : product.lister_storefronts;
            return (
              <article className="home-product-card" key={product.id}>
                <div className="home-product-media">
                  <Link href={`/products/${product.id}`}>
                    <div className="home-product-image">
                      {product.image_url ? <Image src={product.image_url} alt={product.name} width={600} height={600} unoptimized /> : <div className="product-placeholder">HolyHub</div>}
                      <span>{product.category_type}</span>
                    </div>
                  </Link>
                  <FavouriteButton productId={product.id} initialSaved={favouriteIds.has(product.id)} />
                </div>
                <Link href={`/products/${product.id}`}>
                <div className="home-product-copy">
                  <small>{storefront?.business_name ?? "HolyHub lister"}</small>
                  <h3>{product.name}</h3>
                  <strong>£{Number(product.price).toFixed(2)}</strong>
                </div>
                </Link>
              </article>
            );
          })}

          {homepageDemoProducts.map((product) => (
            <article className="home-product-card demo-product-card" key={product.id}>
              <div className="home-product-image">
                <Image src={product.image_url} alt="" width={600} height={600} unoptimized />
                <span>{product.category_type}</span>
              </div>
              <div className="home-product-copy">
                <small>{product.listerName} · DEMO</small>
                <h3>{product.name}</h3>
                <strong>£{product.price.toFixed(2)}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

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
