import { CUSTOMER_PRODUCT_CATEGORIES, isCustomerProductCategory, marketplaceCategoryValues, productCategoryLabel } from "@/lib/product-categories";
import { withProductCover } from "@/lib/product-images";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HolyHubIcon } from "@/components/holyhub-icon";
import { FavouriteButton } from "@/components/favourite-button";
import { getFavouriteIds } from "@/lib/favourites";
import { decodeDisplayText } from "@/lib/display-text";

export const dynamic = "force-dynamic";

type MarketplaceParams = { q?: string; category?: string; min?: string; max?: string; sort?: string };

const categoryIcons = {
  "Clothing & Accessories": "activity",
  Jewellery: "community",
  "Books & Stationery": "bible",
  Gifts: "festival",
  "Home & Living": "home",
  "Art & Prints": "opportunities",
} as const;
const featuredCategories = CUSTOMER_PRODUCT_CATEGORIES.map(value => ({ label: value, value, icon: categoryIcons[value] }));

function parseOptionalPrice(value?: string) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const price = Number(trimmed);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

function marketplaceHref(params: MarketplaceParams, category: string) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (category) query.set("category", category);
  if (params.min) query.set("min", params.min);
  if (params.max) query.set("max", params.max);
  if (params.sort) query.set("sort", params.sort);
  const suffix = query.toString();
  return suffix ? `/marketplace?${suffix}` : "/marketplace";
}

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<MarketplaceParams> }) {
  const params = await searchParams;
  const search = (params.q?.trim() ?? "").replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim();
  const mappedCategory = productCategoryLabel(params.category?.trim() ?? "");
  const category = isCustomerProductCategory(mappedCategory) ? mappedCategory : "";
  const min = parseOptionalPrice(params.min);
  const max = parseOptionalPrice(params.max);
  const sort = params.sort ?? "newest";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const favouriteIds = await getFavouriteIds(supabase, user?.id);
  let query = supabase.from("products").select("id, name, description, category_type, price, image_url, stock_quantity, lister_user_id, product_images(image_url, sort_order), product_variants(id, size, stock_quantity), lister_storefronts(business_name, delivery_option, delivery_charge, delivery_country)").eq("is_published", true);
  if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  if (category) query = query.in("category_type", marketplaceCategoryValues(category));
  if (min !== null) query = query.gte("price", min);
  if (max !== null) query = query.lte("price", max);
  if (sort === "price-low") query = query.order("price", { ascending: true });
  else if (sort === "price-high") query = query.order("price", { ascending: false });
  else query = query.order("created_at", { ascending: false });
  const { data: rawProducts, error } = await query;
  const products = rawProducts?.map(withProductCover);
  const hasFilters = Boolean(search || category || min !== null || max !== null);
  const resultsTitle = search ? `Results for “${search}”` : category || "Discover Christian brands";

  return (
    <section className="marketplace-page">
      <div className="marketplace-hero">
        <div>
          <p className="eyebrow">The HolyHub Marketplace</p>
          <h1>Discover Christian brands you&apos;ll love</h1>
          <p>Shop clothing, gifts, books and more from Christian businesses, all in one place.</p>
        </div>
      </div>

      <form className="marketplace-filter" method="get">
        <div className="marketplace-search">
          <span aria-hidden="true">⌕</span>
          <label className="sr-only" htmlFor="q">Search products or brands</label>
          <input id="q" name="q" type="search" defaultValue={search} placeholder="Search products or brands" />
          <button className="button button-primary" type="submit">Search</button>
        </div>
        <div className="marketplace-filter-row">
          <label><span>Category</span><select id="category" name="category" defaultValue={category}><option value="">All categories</option>{CUSTOMER_PRODUCT_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>Min price</span><input id="min" name="min" type="number" min="0" step="0.01" defaultValue={params.min ?? ""} placeholder="£0" /></label>
          <label><span>Max price</span><input id="max" name="max" type="number" min="0" step="0.01" defaultValue={params.max ?? ""} placeholder="Any" /></label>
          <label><span>Sort by</span><select id="sort" name="sort" defaultValue={sort}><option value="newest">Newest</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label>
          <Link className="marketplace-clear" href="/marketplace">Clear filters</Link>
        </div>
      </form>

      <div className="marketplace-categories" aria-label="Browse categories">
        <Link className={!category ? "active" : ""} href={marketplaceHref(params, "")}><HolyHubIcon name="marketplace" /><span>All</span></Link>
        {featuredCategories.map((item) => <Link className={category === item.value ? "active" : ""} href={marketplaceHref(params, item.value)} key={item.value}><HolyHubIcon name={item.icon} /><span>{item.label}</span></Link>)}
      </div>

      {!error && <div className="marketplace-results-heading"><div><p className="eyebrow">Explore the marketplace</p><h2>{resultsTitle}</h2></div><p>{products?.length ?? 0} {(products?.length ?? 0) === 1 ? "product" : "products"}</p></div>}

      {error && <div className="marketplace-status marketplace-status-error"><strong>Oops... looks like something went wrong.</strong><p>Please refresh the page in a moment.</p><div className="button-row"><a className="button button-primary" href="/marketplace">Try again</a><Link className="button button-quiet" href="/">Back to home</Link></div></div>}
      {!error && products?.length ? (
        <div className="product-grid marketplace-grid">
          {products.map((product) => {
            const storefront = Array.isArray(product.lister_storefronts) ? product.lister_storefronts[0] : product.lister_storefronts;
            return <article className="product-card marketplace-card" key={product.id}>
              <div className="marketplace-card-media"><Link href={`/products/${product.id}`}><div className="marketplace-card-image">{product.image_url ? <Image src={product.image_url} alt={decodeDisplayText(product.name)} width={600} height={600} unoptimized /> : <div className="product-placeholder" aria-hidden="true">HolyHub</div>}<span>{productCategoryLabel(product.category_type)}</span></div></Link><FavouriteButton productId={product.id} initialSaved={favouriteIds.has(product.id)} /></div>
              <Link href={`/products/${product.id}`}><div className="product-card-body">{storefront?.business_name && <p className="marketplace-lister" style={{ fontSize: ".85rem" }}>{storefront.business_name}</p>}<h3>{decodeDisplayText(product.name)}</h3><strong>£{Number(product.price).toFixed(2)}</strong></div></Link>
            </article>;
          })}
        </div>
      ) : null}

      {!error && !products?.length && hasFilters ? <div className="marketplace-status"><strong>No products found</strong><p>Try another search, browse a different category or clear your filters.</p><Link className="button button-primary" href="/marketplace">View all products</Link></div> : null}
      {!error && !products?.length && !hasFilters ? <div className="marketplace-status"><strong>Products are coming soon</strong><p>We’re getting the first approved Christian brands ready for the marketplace.</p></div> : null}
    </section>
  );
}