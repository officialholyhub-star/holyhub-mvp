import { ErrorRecovery } from "@/components/error-recovery";
import { ProductGallery } from "@/components/product-gallery";
import { orderedProductImages } from "@/lib/product-images";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddToBasketButton } from "@/components/add-to-basket-button";
import { FavouriteButton } from "@/components/favourite-button";
import { getFavouriteIds } from "@/lib/favourites";
import { dispatchTerms } from "@/lib/dispatch-timeframe";
import { formatRegisteredOffice, formatSellerAddress, formatServiceAddress, sellerEntityLabel, type SellerLegalInput } from "@/lib/seller-legal";
import brandStyles from "@/components/storefront-brand.module.css";
import styles from "./product-detail.module.css";
import { decodeDisplayText } from "@/lib/display-text";

export const dynamic = "force-dynamic";

type PublicSellerIdentity = SellerLegalInput & { user_id: string };

function stockMessage(stock: number) {
  if (stock <= 0) return "Out of stock";
  return stock <= 3 ? `Only ${stock} left` : "In stock";
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: product, error } = await supabase.from("products").select("id, name, description, category_type, price, image_url, size_guide_url, stock_quantity, lister_user_id, product_images(image_url, sort_order), product_variants(id, size, stock_quantity), lister_storefronts(user_id, business_name, description, category_type, logo_url, delivery_option, delivery_charge, delivery_country, dispatch_window, dispatch_custom_timeframe)").eq("id", id).eq("is_published", true).eq("review_status", "approved").maybeSingle();
  if (error) return <ErrorRecovery title="We couldn’t load these details" message="Please refresh before editing or continuing. Your saved details could not be checked." href="/marketplace" label="Return to marketplace" />;
  if (!product) notFound();

  const { data: identities, error: identityError } = await supabase.rpc("get_public_seller_identities", { p_user_ids: [product.lister_user_id] });
  if (identityError) return <ErrorRecovery title="We couldn’t verify the seller details" message="Please refresh before continuing." href="/marketplace" label="Return to marketplace" />;
  const sellerIdentity = (identities?.[0] ?? null) as PublicSellerIdentity | null;
  if (!sellerIdentity) notFound();

  const images = orderedProductImages(product.product_images, product.image_url);
  const storefront = Array.isArray(product.lister_storefronts) ? product.lister_storefronts[0] : product.lister_storefronts;
  const dispatchPromise = dispatchTerms(storefront?.dispatch_window, storefront?.dispatch_custom_timeframe);
  if (!storefront || !dispatchPromise) return <ErrorRecovery title="This product isn’t ready for checkout yet" message="The seller’s dispatch timeframe still needs to be confirmed." href="/marketplace" label="Return to marketplace" />;
  const variantStock = (product.product_variants ?? []).reduce((total, variant) => total + variant.stock_quantity, 0);
  const availableStock = product.product_variants?.length ? variantStock : product.stock_quantity;
  const favouriteIds = await getFavouriteIds(supabase, user?.id);
  const serviceAddress = formatServiceAddress(sellerIdentity);
  const registeredOffice = formatRegisteredOffice(sellerIdentity);

  return (
    <section className="product-detail">
      <Link className="text-link" href="/marketplace">Back to marketplace</Link>
      <div className="product-detail-grid">
        <ProductGallery images={images} name={decodeDisplayText(product.name)} />
        <div className={styles.detailContent}>
          <Link className="eyebrow" href={`/lister/storefront/${storefront.user_id}`}>{storefront.business_name}</Link>
          <h1 className="page-title">{decodeDisplayText(product.name)}</h1>
          <div className="product-detail-price-row"><p className="product-price">£{Number(product.price).toFixed(2)}</p><FavouriteButton productId={product.id} initialSaved={favouriteIds.has(product.id)} /></div>
          <p className={styles.category}>{product.category_type}</p>
          <p className={styles.description}>{product.description}</p>
          {product.size_guide_url && <p><a className="text-link" href={product.size_guide_url} target="_blank" rel="noopener noreferrer">View size guide</a></p>}
          <div className={styles.productFacts} aria-label="Product information"><p><span>Availability</span><strong>{stockMessage(availableStock)}</strong></p><p><span>Delivery</span><strong>{storefront.delivery_option === "flat" ? `£${Number(storefront.delivery_charge ?? 0).toFixed(2)}` : "Free"}</strong></p><p><span>Dispatch</span><strong>{dispatchPromise}</strong></p></div>
          <div className={styles.purchaseAction}><AddToBasketButton id={product.id} name={product.name} price={Number(product.price)} currency="GBP" imageUrl={images[0] ?? null} listerId={product.lister_user_id} listerName={storefront.business_name || sellerIdentity.legal_name} deliveryOption={storefront.delivery_option === "flat" ? "flat" : "free"} deliveryCharge={Number(storefront.delivery_charge ?? 0)} stockQuantity={product.stock_quantity} variants={product.product_variants ?? []} /></div>
          <p className={styles.secureNote}>Secure checkout</p>
          <p className={styles.returnsNote}>See our <Link className="text-link" href="/returns">returns policy</Link> for refund information.</p>
          <div className={`${brandStyles.summary} ${styles.brandSection}`}><div className={brandStyles.brandHeader}>{storefront.logo_url && <Image className={brandStyles.logo} src={storefront.logo_url} alt={`${storefront.business_name} logo`} width={64} height={64} unoptimized />}<div className={brandStyles.brandTitle}><h2><Link href={`/lister/storefront/${storefront.user_id}`}>About {storefront.business_name}</Link></h2><p className="muted-small">{storefront.category_type}</p></div></div><p>{storefront.description}</p></div>
          <section className={`${brandStyles.summary} ${styles.brandSection}`} aria-labelledby="seller-details-heading">
            <h2 id="seller-details-heading">Seller details</h2>
            <dl className="review-details">
              {storefront.business_name && <div><dt>Trading name</dt><dd>{storefront.business_name}</dd></div>}
              <div><dt>Legal seller</dt><dd>{sellerIdentity.legal_name}</dd></div>
              <div><dt>Legal structure</dt><dd>{sellerEntityLabel(sellerIdentity.entity_type)}</dd></div>
              <div><dt>Business address</dt><dd>{formatSellerAddress(sellerIdentity)}</dd></div>
              {serviceAddress && <div><dt>Service address</dt><dd>{serviceAddress}</dd></div>}
              <div><dt>Email</dt><dd><a href={`mailto:${sellerIdentity.contact_email}`}>{sellerIdentity.contact_email}</a></dd></div>
              {sellerIdentity.contact_phone && <div><dt>Phone</dt><dd><a href={`tel:${sellerIdentity.contact_phone}`}>{sellerIdentity.contact_phone}</a></dd></div>}
              {sellerIdentity.registration_number && <div><dt>Registration number</dt><dd>{sellerIdentity.registration_number}</dd></div>}
              {sellerIdentity.registration_jurisdiction && <div><dt>Registered in</dt><dd>{sellerIdentity.registration_jurisdiction}</dd></div>}
              {registeredOffice && <div><dt>Registered office</dt><dd>{registeredOffice}</dd></div>}
              {sellerIdentity.vat_number && <div><dt>VAT number</dt><dd>{sellerIdentity.vat_number}</dd></div>}
            </dl>
          </section>
        </div>
      </div>
    </section>
  );
}
