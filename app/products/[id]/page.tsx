import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddToBasketButton } from "@/components/add-to-basket-button";
import { FavouriteButton } from "@/components/favourite-button";
import { getFavouriteIds } from "@/lib/favourites";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: product } = await supabase.from("products").select("id, name, description, category_type, price, image_url, stock_quantity, lister_user_id, lister_storefronts(user_id, business_name, description, website_or_social, delivery_option, delivery_charge, delivery_country)").eq("id", id).eq("is_published", true).maybeSingle();
  if (!product) notFound();
  const storefront = Array.isArray(product.lister_storefronts) ? product.lister_storefronts[0] : product.lister_storefronts;
  const favouriteIds = await getFavouriteIds(supabase, user?.id);

  return (
    <section className="product-detail">
      <Link className="text-link" href="/marketplace">Back to marketplace</Link>
      <div className="product-detail-grid">
        <div>{product.image_url ? <Image className="product-detail-image" src={product.image_url} alt={product.name} width={800} height={800} unoptimized /> : <div className="product-detail-placeholder">HolyHub</div>}</div>
        <div>
          <p className="eyebrow">{storefront?.business_name ?? "HolyHub lister"}</p>
          <h1 className="page-title">{product.name}</h1>
          <div className="product-detail-price-row">
            <p className="product-price">£{Number(product.price).toFixed(2)}</p>
            <FavouriteButton productId={product.id} initialSaved={favouriteIds.has(product.id)} />
          </div>
          <p className="muted-small">{product.category_type}</p>
          <p>{product.description}</p>
          <AddToBasketButton id={product.id} name={product.name} price={Number(product.price)} currency="GBP" imageUrl={product.image_url} listerId={product.lister_user_id} listerName={storefront?.business_name ?? "HolyHub lister"} deliveryOption={storefront?.delivery_option === "flat" ? "flat" : "free"} deliveryCharge={Number(storefront?.delivery_charge ?? 0)} />
          {storefront && <div className="storefront-summary"><h2>About {storefront.business_name}</h2><p>{storefront.description}</p>{storefront.website_or_social && <a className="text-link" href={storefront.website_or_social} rel="noreferrer">Visit website or social page</a>}</div>}
        </div>
      </div>
    </section>
  );
}