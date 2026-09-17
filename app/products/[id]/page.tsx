import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddToBasketButton } from "@/components/add-to-basket-button";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("id, name, description, category_type, price, image_url, lister_storefronts(user_id, business_name, description, website_or_social)").eq("id", id).eq("is_published", true).maybeSingle();
  if (!product) notFound();
  const storefront = Array.isArray(product.lister_storefronts) ? product.lister_storefronts[0] : product.lister_storefronts;

  return (
    <section className="product-detail">
      <Link className="text-link" href="/marketplace">Back to marketplace</Link>
      <div className="product-detail-grid">
        <div>{product.image_url ? <img className="product-detail-image" src={product.image_url} alt={product.name} /> : <div className="product-detail-placeholder">HolyHub</div>}</div>
        <div>
          <p className="eyebrow">{storefront?.business_name ?? "HolyHub lister"}</p>
          <h1 className="page-title">{product.name}</h1>
          <p className="product-price">£{Number(product.price).toFixed(2)}</p>
          <p className="muted-small">{product.category_type}</p>
          <p>{product.description}</p>
          <AddToBasketButton id={product.id} name={product.name} price={Number(product.price)} currency="GBP" imageUrl={product.image_url} listerName={storefront?.business_name ?? "HolyHub lister"} />
          {storefront && <div className="storefront-summary"><h2>About {storefront.business_name}</h2><p>{storefront.description}</p>{storefront.website_or_social && <a className="text-link" href={storefront.website_or_social} rel="noreferrer">Visit website or social page</a>}</div>}
        </div>
      </div>
    </section>
  );
}