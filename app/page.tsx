import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { productCategories, type Product } from "@/lib/marketplace";
import { ProductCard } from "@/components/product-card";
import { DiscoveryPaths } from "@/components/discovery-paths";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: featured, error: featuredError } = await supabase.from("products")
    .select("*").eq("status", "published").eq("moderation_status", "visible")
    .order("created_at", { ascending: false }).limit(4);

  return <>
    <section className="editorial-hero" aria-labelledby="home-title">
      <div className="hero-copy">
        <p className="editorial-kicker"><span aria-hidden="true" /> Connect. Discover. Grow.</p>
        <h1 id="home-title">Good things.<br />Shared faith.<br /><span className="accent-word">One HolyHub.</span></h1>
        <p className="lead">Where Christian brands, events & community meet. Discover independent businesses and find something worth showing up for.</p>
        <form action="/products" className="hero-search" role="search" aria-label="Search the marketplace">
          <label htmlFor="home-search" className="sr-only">Search products</label>
          <input id="home-search" name="q" type="search" placeholder="What would you love to discover?" maxLength={120} />
          <button type="submit" aria-label="Search products"><span aria-hidden="true">→</span></button>
        </form>
        <div className="hero-links"><Link href="/products">Discover Christian Brands <span aria-hidden="true">→</span></Link><Link href="/account/business">Become a Lister <span aria-hidden="true">→</span></Link></div>
      </div>
      <figure className="editorial-image">
        <Image src="/holyhub-community-editorial.webp" alt="An editorial image of hands sharing a ceramic mug across a sunlit maker’s table" width={960} height={1200} sizes="(max-width: 720px) 100vw, 44vw" priority />
        <div className="editorial-image-label"><span aria-hidden="true">✳</span><span>Rooted in faith.<br /><strong>Made for connection.</strong></span></div>
        <figcaption>Good discoveries start with people.</figcaption>
      </figure>
    </section>
    <section className="discovery-section" aria-labelledby="discovery-title">
      <div className="split-heading"><div><p className="editorial-kicker">A place for your kind of discovery</p><h2 id="discovery-title">Find your next connection.</h2></div><span className="section-note">A little discovery. A lot of possibility.</span></div>
      <DiscoveryPaths />
    </section>
    <nav className="category-strip" aria-label="Explore by category"><span>Find your thing</span>{productCategories.map(category => <Link key={category} href={`/products?category=${encodeURIComponent(category)}`}>{category}<span aria-hidden="true"> ↗</span></Link>)}</nav>
    {featuredError ? <div className="notice notice-info top-space" role="status">The collection is temporarily unavailable. Please try again shortly.</div> : !featured?.length && <section className="listing-invite"><div><p className="editorial-kicker">For the makers. The founders. The doers.</p><h2>Be among our first brands.</h2><p>Bring your Christian business to HolyHub. Create your profile and submit it for review.</p></div><Link className="button button-primary" href="/account/business">List your business <span aria-hidden="true">→</span></Link></section>}
    {!!featured?.length && <section className="featured-section"><div className="split-heading"><div><p className="editorial-kicker">Fresh discoveries</p><h2>Meet your next favourite.</h2></div><Link href="/products" className="text-link">Explore the collection →</Link></div><div className="product-grid">{(featured as Product[]).map(product => <ProductCard key={product.id} product={product} />)}</div></section>}
  </>;
}
