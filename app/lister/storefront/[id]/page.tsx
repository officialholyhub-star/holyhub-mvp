import { isValidHttpUrl } from "@/lib/product-validation";
import { withProductCover } from "@/lib/product-images";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function PublicListerStorefrontPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: storefront } = await supabase
    .from("lister_storefronts")
    .select("user_id, business_name, description, category_type, logo_url, website_url, instagram_url, website_or_social")
    .eq("user_id", id)
    .maybeSingle();

  if (!storefront) notFound();

  const { data: rawProducts } = await supabase
    .from("products")
    .select("id, name, price, image_url, category_type, product_images(image_url, sort_order)")
    .eq("lister_user_id", id)
    .eq("is_published", true)
    .eq("review_status", "approved")
    .order("created_at", { ascending: false });

  const products = rawProducts?.map(withProductCover);
  const websiteCandidate = storefront.website_url ?? (!storefront.instagram_url ? storefront.website_or_social : null);
  const websiteUrl = websiteCandidate && isValidHttpUrl(websiteCandidate) ? websiteCandidate : null;
  const instagramUrl = storefront.instagram_url && isValidHttpUrl(storefront.instagram_url) ? storefront.instagram_url : null;

  return (
    <section className={`page-shell ${styles.page}`}>
      <Link className="text-link" href="/marketplace">Back to marketplace</Link>
      <header className={styles.brandHeader}>
        {storefront.logo_url ? (
          <Image className={styles.logo} src={storefront.logo_url} alt={`${storefront.business_name} logo`} width={144} height={144} unoptimized />
        ) : (
          <div className={styles.logoPlaceholder} aria-hidden="true">{storefront.business_name.slice(0, 1).toUpperCase()}</div>
        )}
        <div className={styles.brandCopy}>
          <p className="eyebrow">{storefront.category_type}</p>
          <h1>{storefront.business_name}</h1>
          <p>{storefront.description}</p>

        </div>
      </header>
      <section className={styles.productsSection} aria-labelledby="storefront-products-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Shop on HolyHub</p>
            <h2 id="storefront-products-title">Products from {storefront.business_name}</h2>
          </div>
          <span>{products?.length ?? 0} products</span>
        </div>
        {products?.length ? (
          <div className={styles.productGrid}>
            {products.map((product) => (
              <Link className={styles.product} href={`/products/${product.id}`} key={product.id}>
                {product.image_url ? (
                  <Image src={product.image_url} alt={product.name} width={480} height={360} unoptimized />
                ) : (
                  <div className={styles.productPlaceholder}>HolyHub</div>
                )}
                <div className={styles.productDetails}>
                  <p>{product.category_type}</p>
                  <h3>{product.name}</h3>
                  <strong>£{Number(product.price).toFixed(2)}</strong>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>This brand has no products available right now.</p>
        )}
      </section>
      <nav className={styles.brandLinks} aria-label="Discover more about this brand">
        {instagramUrl && <a href={instagramUrl} target="_blank" rel="noopener noreferrer">Instagram or social ↗</a>}
        {websiteUrl && <a href={websiteUrl} target="_blank" rel="noopener noreferrer">Visit brand website ↗</a>}
      </nav>
    </section>
  );
}