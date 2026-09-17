import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AddToBasketButton } from "@/components/add-to-basket-button";

export const dynamic = "force-dynamic";

type MarketplaceParams = { q?: string; category?: string; min?: string; max?: string };

function parseOptionalPrice(value?: string) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const price = Number(trimmed);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<MarketplaceParams> }) {
  const params = await searchParams;
  const search = (params.q?.trim() ?? "").replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim();
  const category = params.category?.trim() ?? "";
  const min = parseOptionalPrice(params.min);
  const max = parseOptionalPrice(params.max);
  const supabase = await createClient();
  let query = supabase.from("products").select("id, name, description, category_type, price, image_url, lister_storefronts(business_name)").eq("is_published", true).order("created_at", { ascending: false });
  if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  if (category) query = query.eq("category_type", category);
  if (min !== null) query = query.gte("price", min);
  if (max !== null) query = query.lte("price", max);
  const { data: products, error } = await query;
  const { data: categories } = await supabase.from("products").select("category_type").eq("is_published", true).order("category_type");
  const uniqueCategories = [...new Set((categories ?? []).map(({ category_type }) => category_type))];

  return (
    <section>
      <Link className="text-link" href="/">Back to home</Link>
      <p className="eyebrow">HolyHub marketplace</p>
      <h1 className="page-title">Discover Christian products</h1>
      <p className="lead">Browse products from Christian businesses and brands.</p>
      <form className="filter-bar" method="get">
        <div className="field">
          <label htmlFor="q">Search</label>
          <input id="q" name="q" type="search" defaultValue={search} placeholder="Search products" />
        </div>
        <div className="field">
          <label htmlFor="category">Category</label>
          <select id="category" name="category" defaultValue={category}>
            <option value="">All categories</option>
            {uniqueCategories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="min">Min price</label>
          <input id="min" name="min" type="number" min="0" step="0.01" defaultValue={params.min ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="max">Max price</label>
          <input id="max" name="max" type="number" min="0" step="0.01" defaultValue={params.max ?? ""} />
        </div>
        <button className="button button-primary" type="submit">Apply filters</button>
      </form>
      {error && <p className="notice notice-error">Products are temporarily unavailable.</p>}
      {products?.length ? (
        <div className="product-grid">
          {products.map((product) => {
            const storefront = Array.isArray(product.lister_storefronts) ? product.lister_storefronts[0] : product.lister_storefronts;
            return (
              <article className="product-card" key={product.id}>
                <Link href={`/products/${product.id}`}>
                {product.image_url ? <img src={product.image_url} alt="" /> : <div className="product-placeholder" aria-hidden="true">HolyHub</div>}
                <div className="product-card-body">
                  <p className="eyebrow">{storefront?.business_name ?? "HolyHub lister"}</p>
                  <h2>{product.name}</h2>
                  <p className="muted-small">{product.category_type}</p>
                  <strong>£{Number(product.price).toFixed(2)}</strong>
                </div>
                </Link>
                <div className="product-card-action"><AddToBasketButton id={product.id} name={product.name} price={Number(product.price)} currency="GBP" imageUrl={product.image_url} listerName={storefront?.business_name ?? "HolyHub lister"} /></div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card empty-state"><p>No published products match those filters.</p></div>
      )}
    </section>
  );
}