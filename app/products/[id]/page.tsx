import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddToBasketButton } from "@/components/add-to-basket-button";
import { FavouriteButton } from "@/components/favourite-button";
import { getFavouriteIds } from "@/lib/favourites";
import brandStyles from "@/components/storefront-brand.module.css";
import styles from "./product-detail.module.css";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: product } = await supabase.from("products").select("id, name, description, category_type, price, image_url, stock_quantity, lister_user_id, lister_storefronts(user_id, business_name, description, category_type, logo_url, website_url, instagram_url, website_or_social, delivery_option, delivery_charge, delivery_country)").eq("id", id).eq("is_published", true).maybeSingle();
  if (!product) notFound();
  const storefront = Array.isArray(product.lister_storefronts) ? product.lister_storefronts[0] : product.lister_storefronts;
  const favouriteIds = await getFavouriteIds(supabase, user?.id);

  return (
    <section className="product-detail">
      <Link className="text-link" href="/marketplace">Back to marketplace</Link>
      <div className="product-detail-grid">
        <div>{product.image_url ? <Image className="product-detail-image" src={product.image_url} alt={product.name} width={800} height={800} unoptimized /> : <div className="product-detail-placeholder">HolyHub</div>}</div>
        <div className={styles.detailContent}>
          {storefront ? (
            <Link className="eyebrow" href={`/lister/storefront/${storefront.user_id}`}>{storefront.business_name}</Link>
          ) : (
            <p className="eyebrow">HolyHub lister</p>
          )}
          <h1 className="page-title">{product.name}</h1>
          <div className="product-detail-price-row">
            <p className="product-price">£{Number(product.price).toFixed(2)}</p>
            <FavouriteButton productId={product.id} initialSaved={favouriteIds.has(product.id)} />
          </div>
          <p className={styles.category}>{product.category_type}</p>
          <p className={styles.description}>{product.description}</p>
          <div className={styles.productFacts} aria-label="Product information">
            <p><span>Availability</span><strong>{product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : "Out of stock"}</strong></p>
            <p><span>Delivery</span><strong>{storefront?.delivery_option === "flat" ? `£${Number(storefront.delivery_charge ?? 0).toFixed(2)}` : "Free"}</strong></p>
          </div>
          <div className={styles.purchaseAction}>
            <AddToBasketButton id={product.id} name={product.name} price={Number(product.price)} currency="GBP" imageUrl={product.image_url} listerId={product.lister_user_id} listerName={storefront?.business_name ?? "HolyHub lister"} deliveryOption={storefront?.delivery_option === "flat" ? "flat" : "free"} deliveryCharge={Number(storefront?.delivery_charge ?? 0)} stockQuantity={product.stock_quantity} />
          </div>
          <p className={styles.secureNote}>Secure checkout</p>
          <p className={styles.returnsNote}>See our <Link className="text-link" href="/returns">returns policy</Link> for refund information.</p>
          {storefront && (
            <div className={`${brandStyles.summary} ${styles.brandSection}`}>
              <div className={brandStyles.brandHeader}>
                {storefront.logo_url && <Image className={brandStyles.logo} src={storefront.logo_url} alt={`${storefront.business_name} logo`} width={64} height={64} unoptimized />}
                <div className={brandStyles.brandTitle}>
                  <h2><Link href={`/lister/storefront/${storefront.user_id}`}>About {storefront.business_name}</Link></h2>
                  <p className="muted-small">{storefront.category_type}</p>
                </div>
              </div>
              <p>{storefront.description}</p>
              <div className={brandStyles.links}>
                {(storefront.website_url ?? (!storefront.instagram_url ? storefront.website_or_social : null)) && <a href={storefront.website_url ?? storefront.website_or_social!} target="_blank" rel="noopener noreferrer">Website</a>}
                {storefront.instagram_url && <a href={storefront.instagram_url} target="_blank" rel="noopener noreferrer">Instagram or social</a>}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}