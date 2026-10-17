import { PRODUCT_CATEGORIES, isProductCategory, marketplaceCategoryValues, productCategoryLabel } from "@/lib/product-categories";
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
  Apparel: "activity", Bookmarks: "bible", Gifts: "festival", Books: "bible",
  Jewellery: "community", "Home & Living": "home", Arts: "opportunities",
} as const;
const featuredCategories = PRODUCT_CATEGORIES.map(value => ({ label: value, value, icon: categoryIcons[value] }));

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
  const category = productCategoryLabel(params.category?.trim() ?? "");
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
  const categoryOptions = PRODUCT_CATEGORIES;
  const hasFilters = Boolean(search || category || min !== null || max !== null);
  const resultsHeading = search
    ? { eyebrow: "Search results", title: `Results for “${search}”`, support: "Explore products matching your search." }
    : category
      ? { eyebrow: "Category", title: category, support: "Browse products in this category." }
      : { eyebrow: "Shop Christian brands", title: "All products", support: "Discover faith-led products from independent sellers." };

  return (
    <section className="marketplace-page">
      <div className="marketplace-hero">
        <div>
          <p className="eyebrow">The HolyHub marketplace</p>
          <h1>Discover Christian brands you&apos;ll love</h1>
          <p>Shop clothing, gifts, books and more from Christian businesses—all in one place.</p>
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
          <label><span>Category</span><select id="category" name="category" defaultValue={category}><option value="">All categories</option>{category && !isProductCategory(category) && <option value={category}>{category} (existing category)</option>}{categoryOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>Min price</span><input id="min" name="min" type="number" min="0" step="0.01" defaultValue={params.min ?? ""} placeholder="£0" /></label>
          <label><span>Max price</span><input id="max" name="max" type="number" min="0" step="0.01" defaultValue={params.max ?? ""} placeholder="Any" /></label>
          <label><span>Sort by</span><select id="sort" name="sort" defaultValue={sort}><option value="newest">Newest</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label>
          <Link className="marketplace-clear" href="/marketplace">Clear</Link>
        </div>
      </form>

      <div className="marketplace-categories" aria-label="Browse categories">
        <Link className={!category ? "active" : ""} href={marketplaceHref(params, "")}><HolyHubIcon name="marketplace" /><span>All</span></Link>
        {featuredCategories.map((item) => <Link className={category === item.value ? "active" : ""} href={marketplaceHref(params, item.value)} key={item.value}><HolyHubIcon name={item.icon} /><span>{item.label}</span></Link>)}
      </div>

      {!error && <div className="marketplace-results-heading"><div><p className="eyebrow">{resultsHeading.eyebrow}</p><h2>{resultsHeading.title}</h2><p>{resultsHeading.support}</p></div><p>{products?.length ?? 0} {(products?.length ?? 0) === 1 ? "product" : "products"}</p></div>}

      {error && <div className="marketplace-status marketplace-status-error"><p className="eyebrow">Marketplace</p><strong>We couldn&apos;t load products</strong><p>Please refresh the page and try again.</p><div className="button-row"><a className="button button-primary" href="/marketplace">Try again</a><Link className="button button-quiet" href="/">Back to home</Link></div></div>}
      {!error && products?.length ? (
        <div className="product-grid marketplace-grid">
          {products.map((product) => {
            const storefront = Array.isArray(product.lister_storefronts) ? product.lister_storefronts[0] : product.lister_storefronts;
            return <article className="product-card marketplace-card" key={product.id}>
              <div className="marketplace-card-media"><Link href={`/products/${product.id}`}><div className="marketplace-card-image">{product.image_url ? <Image src={product.image_url} alt={decodeDisplayText(product.name)} width={600} height={600} unoptimized /> : <div className="product-placeholder" aria-hidden="true">HolyHub</div>}<span>{productCategoryLabel(product.category_type)}</span></div></Link><FavouriteButton productId={product.id} initialSaved={favouriteIds.has(product.id)} /></div>
              <Link href={`/products/${product.id}`}><div className="product-card-body">{storefront?.business_name && <p className="marketplace-lister">{storefront.business_name}</p>}<h3>{decodeDisplayText(product.name)}</h3><strong>£{Number(product.price).toFixed(2)}</strong></div></Link>
            </article>;
          })}
        </div>
      ) : null}

      {!error && !products?.length ? <div className="marketplace-status">{hasFilters ? <><p className="eyebrow">Search results</p><strong>No products found</strong><p>Try another search, category or price range.</p><Link className="button button-primary" href="/marketplace">View all products</Link></> : <><p className="eyebrow">Marketplace</p><strong>Products are coming soon</strong><p>We&apos;re onboarding our first sellers now. Check back shortly to discover faith-led products from independent Christian brands.</p></>}</div> : null}
    </section>
  );
}
