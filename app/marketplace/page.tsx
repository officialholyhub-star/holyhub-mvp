import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AddToBasketButton } from "@/components/add-to-basket-button";

export const dynamic = "force-dynamic";

type MarketplaceParams = { q?: string; category?: string; min?: string; max?: string; sort?: string };

const featuredCategories = [
  "Clothing & accessories",
  "Jewellery",
  "Books & stationery",
  "Gifts",
  "Home & living",
  "Art & prints",
];

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
  const category = params.category?.trim() ?? "";
  const min = parseOptionalPrice(params.min);
  const max = parseOptionalPrice(params.max);
  const sort = params.sort ?? "newest";
  const supabase = await createClient();
  let query = supabase.from("products").select("id, name, description, category_type, price, image_url, lister_storefronts(business_name)").eq("is_published", true);
  if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  if (category) query = query.eq("category_type", category);
  if (min !== null) query = query.gte("price", min);
  if (max !== null) query = query.lte("price", max);
  if (sort === "price-low") query = query.order("price", { ascending: true });
  else if (sort === "price-high") query = query.order("price", { ascending: false });
  else query = query.order("created_at", { ascending: false });
  const { data: products, error } = await query;
  const { data: categories } = await supabase.from("products").select("category_type").eq("is_published", true).order("category_type");
  const uniqueCategories = [...new Set((categories ?? []).map(({ category_type }) => category_type))];
  const categoryOptions = [...new Set([...featuredCategories, ...uniqueCategories])];

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
          <label>
            <span>Category</span>
            <select id="category" name="category" defaultValue={category}>
              <option value="">All categories</option>
              {categoryOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>Min price</span>
            <input id="min" name="min" type="number" min="0" step="0.01" defaultValue={params.min ?? ""} placeholder="£0" />
          </label>
          <label>
            <span>Max price</span>
            <input id="max" name="max" type="number" min="0" step="0.01" defaultValue={params.max ?? ""} placeholder="Any" />
          </label>
          <label>
            <span>Sort by</span>
            <select id="sort" name="sort" defaultValue={sort}>
              <option value="newest">Newest</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </select>
          </label>
          <Link className="marketplace-clear" href="/marketplace">Clear</Link>
        </div>
      </form>

      <div className="marketplace-categories" aria-label="Browse categories">
        <Link className={!category ? "active" : ""} href={marketplaceHref(params, "")}>All</Link>
        {featuredCategories.map((item) => (
          <Link className={category === item ? "active" : ""} href={marketplaceHref(params, item)} key={item}>{item}</Link>
        ))}
      </div>

      <div className="marketplace-results-heading">
        <div>
          <p className="eyebrow">Curated for you</p>
          <h2>{search ? `Results for “${search}”` : category || "Shop Christian brands"}</h2>
        </div>
        {!error && <p>{products?.length ?? 0} {products?.length === 1 ? "product" : "products"}</p>}
      </div>

      {error && (
        <div className="marketplace-status marketplace-status-error">
          <strong>We couldn&apos;t load the products.</strong>
          <p>Please refresh the page in a moment.</p>
        </div>
      )}
      {!error && products?.length ? (
        <div className="product-grid marketplace-grid">
          {products.map((product) => {
            const storefront = Array.isArray(product.lister_storefronts) ? product.lister_storefronts[0] : product.lister_storefronts;
            return (
              <article className="product-card marketplace-card" key={product.id}>
                <Link href={`/products/${product.id}`}>
                  <div className="marketplace-card-image">
                    {product.image_url ? <img src={product.image_url} alt={product.name} /> : <div className="product-placeholder" aria-hidden="true">HolyHub</div>}
                    <span>{product.category_type}</span>
                  </div>
                  <div className="product-card-body">
                    <p className="marketplace-lister">{storefront?.business_name ?? "HolyHub lister"}</p>
                    <h3>{product.name}</h3>
                    <strong>£{Number(product.price).toFixed(2)}</strong>
                  </div>
                </Link>
                <div className="product-card-action"><AddToBasketButton id={product.id} name={product.name} price={Number(product.price)} currency="GBP" imageUrl={product.image_url} listerName={storefront?.business_name ?? "HolyHub lister"} /></div>
              </article>
            );
          })}
        </div>
      ) : !error ? (
        <div className="marketplace-status">
          <strong>No products found</strong>
          <p>Try another search or clear the filters.</p>
          <Link className="button button-primary" href="/marketplace">View all products</Link>
        </div>
      ) : null}
    </section>
  );
}
