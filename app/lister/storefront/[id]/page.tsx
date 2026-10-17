import { ErrorRecovery } from "@/components/error-recovery";
import { isValidHttpUrl } from "@/lib/product-validation";
import { withProductCover } from "@/lib/product-images";
import { formatRegisteredOffice, formatSellerAddress, formatServiceAddress, sellerEntityLabel, type SellerLegalInput } from "@/lib/seller-legal";
import Image from "next/image";
import Link from "next/link";
import { decodeDisplayText } from "@/lib/display-text";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type PublicSellerIdentity = SellerLegalInput & { user_id: string };

export default async function PublicListerStorefrontPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: storefront, error } = await supabase.from("lister_storefronts").select("user_id, business_name, description, category_type, logo_url, website_url, instagram_url, website_or_social").eq("user_id", id).maybeSingle();
  if (error) return <ErrorRecovery title="We couldn’t load these details" message="Please refresh before editing or continuing. Your saved details could not be checked." href="/marketplace" label="Return to marketplace" />;
  if (!storefront) notFound();

  const { data: rawProducts, error: productsError } = await supabase.from("products").select("id, name, price, image_url, category_type, product_images(image_url, sort_order)").eq("lister_user_id", id).eq("is_published", true).eq("review_status", "approved").order("created_at", { ascending: false });
  if (productsError) return <ErrorRecovery title="We couldn’t load this shop’s products" href="/marketplace" label="Return to marketplace" />;
  const products = rawProducts?.map(withProductCover);
  let sellerIdentity: PublicSellerIdentity | null = null;
  if (products?.length) {
    const { data: identities, error: identityError } = await supabase.rpc("get_public_seller_identities", { p_user_ids: [id] });
    if (identityError) return <ErrorRecovery title="We couldn’t verify this seller" href="/marketplace" label="Return to marketplace" />;
    sellerIdentity = (identities?.[0] ?? null) as PublicSellerIdentity | null;
    if (!sellerIdentity) notFound();
  }

  const websiteCandidate = storefront.website_url ?? (!storefront.instagram_url ? storefront.website_or_social : null);
  const websiteUrl = websiteCandidate && isValidHttpUrl(websiteCandidate) ? websiteCandidate : null;
  const instagramUrl = storefront.instagram_url && isValidHttpUrl(storefront.instagram_url) ? storefront.instagram_url : null;
  const serviceAddress = sellerIdentity ? formatServiceAddress(sellerIdentity) : "";
  const registeredOffice = sellerIdentity ? formatRegisteredOffice(sellerIdentity) : "";

  return <section className={`page-shell ${styles.page}`}>
    <Link className="text-link" href="/marketplace">Back to marketplace</Link>
    <header className={styles.brandHeader}>{storefront.logo_url ? <Image className={styles.logo} src={storefront.logo_url} alt={`${storefront.business_name} logo`} width={144} height={144} unoptimized /> : <div className={styles.logoPlaceholder} aria-hidden="true">{storefront.business_name.slice(0, 1).toUpperCase()}</div>}<div className={styles.brandCopy}><p className="eyebrow">{storefront.category_type}</p><h1>{storefront.business_name}</h1><p>{storefront.description}</p></div></header>
    <section className={styles.productsSection} aria-labelledby="storefront-products-title"><div className={styles.sectionHeading}><div><p className="eyebrow">Shop on HolyHub</p><h2 id="storefront-products-title">Products from {storefront.business_name}</h2></div><span>{products?.length ?? 0} {(products?.length ?? 0) === 1 ? "product" : "products"}</span></div>{products?.length ? <div className={styles.productGrid}>{products.map((product) => <Link className={styles.product} href={`/products/${product.id}`} key={product.id}>{product.image_url ? <Image src={product.image_url} alt={decodeDisplayText(product.name)} width={480} height={360} unoptimized /> : <div className={styles.productPlaceholder}>HolyHub</div>}<div className={styles.productDetails}><p>{product.category_type}</p><h3>{decodeDisplayText(product.name)}</h3><strong>£{Number(product.price).toFixed(2)}</strong></div></Link>)}</div> : <div className={styles.empty}><p>This brand has no products available right now.</p><Link className="button button-primary" href="/marketplace">Browse marketplace</Link></div>}</section>
    {sellerIdentity && <section className={styles.productsSection} aria-labelledby="storefront-seller-title"><div className={styles.sectionHeading}><div><p className="eyebrow">Who you’re buying from</p><h2 id="storefront-seller-title">Seller details</h2></div></div><dl className="review-details"><div><dt>Trading name</dt><dd>{storefront.business_name}</dd></div><div><dt>Legal seller</dt><dd>{sellerIdentity.legal_name}</dd></div><div><dt>Legal structure</dt><dd>{sellerEntityLabel(sellerIdentity.entity_type)}</dd></div><div><dt>Business address</dt><dd>{formatSellerAddress(sellerIdentity)}</dd></div>{serviceAddress && <div><dt>Service address</dt><dd>{serviceAddress}</dd></div>}<div><dt>Email</dt><dd><a href={`mailto:${sellerIdentity.contact_email}`}>{sellerIdentity.contact_email}</a></dd></div>{sellerIdentity.contact_phone && <div><dt>Phone</dt><dd><a href={`tel:${sellerIdentity.contact_phone}`}>{sellerIdentity.contact_phone}</a></dd></div>}{sellerIdentity.registration_number && <div><dt>Registration number</dt><dd>{sellerIdentity.registration_number}</dd></div>}{sellerIdentity.registration_jurisdiction && <div><dt>Registered in</dt><dd>{sellerIdentity.registration_jurisdiction}</dd></div>}{registeredOffice && <div><dt>Registered office</dt><dd>{registeredOffice}</dd></div>}{sellerIdentity.vat_number && <div><dt>VAT number</dt><dd>{sellerIdentity.vat_number}</dd></div>}</dl></section>}
    <nav className={styles.brandLinks} aria-label="Discover more about this brand">{instagramUrl && <a href={instagramUrl} target="_blank" rel="noopener noreferrer">Visit Instagram ↗</a>}{websiteUrl && <a href={websiteUrl} target="_blank" rel="noopener noreferrer">Visit brand website ↗</a>}</nav>
  </section>;
}
