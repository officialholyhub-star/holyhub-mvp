import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HolyHubIcon } from "@/components/holyhub-icon";
import { VerseOfTheDay } from "@/components/verse-of-the-day";
import { demoProducts } from "@/lib/demo-products";

export const dynamic = "force-dynamic";

const sections = [
  {
    number: "01",
    name: "The Hub",
    status: "Growing now",
    description: "Bible, community, opportunities and faith-focused spaces designed to help you connect and grow.",
    href: "/hub",
    action: "Enter The Hub",
    className: "home-section-card hub-card",
    icon: "hub" as const,
  },
  {
    number: "02",
    name: "Marketplace",
    status: "Live",
    description: "Discover Christian brands, products and independent listers — all in one place.",
    href: "/marketplace",
    action: "Shop Marketplace",
    className: "home-section-card marketplace-card-home featured-section-card",
    icon: "marketplace" as const,
  },
  {
    number: "03",
    name: "Events",
    status: "Coming soon",
    description: "Find worship nights, conferences, festivals, activities and Christian experiences.",
    href: "/events",
    action: "Explore Events",
    className: "home-section-card events-card",
    icon: "events" as const,
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, image_url, category_type, lister_storefronts(business_name)")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(4);

  const realProducts = products ?? [];
  const demoSlots = Math.max(0, 4 - realProducts.length);
  const homepageDemoProducts = demoProducts.slice(0, demoSlots);

  return (
    <div className="home-page">
      <section className="home-hero home-hero-refresh premium-home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow">HolyHub</p>
          <h1>Connect. Discover. <span>Grow.</span></h1>
          <p className="lead">
            A Christian platform for community, independent brands and events.
          </p>
          <div className="button-row">
            <Link className="button button-primary button-large" href="/marketplace">Explore Marketplace <span aria-hidden="true">→</span></Link>
            <Link className="button button-quiet button-large" href="/hub">Enter The Hub</Link>
          </div>
        </div>

        <VerseOfTheDay hero />
      </section>

      <section className="home-sections" aria-labelledby="holyhub-sections-title">
        <div className="section-heading section-heading-split">
          <div>
            <p className="eyebrow">Explore HolyHub</p>
            <h2 id="holyhub-sections-title">One platform. Three experiences.</h2>
          </div>
          <p>Choose where you want to start.</p>
        </div>

        <div className="home-section-grid">
          {sections.map((section) => (
            <article className={section.className} key={section.name}>
              <div className="section-card-top">
                <span className="section-number">{section.number}</span>
                <span className="section-status">{section.status}</span>
              </div>
              <div className="section-card-icon" aria-hidden="true"><HolyHubIcon name={section.icon} /></div>
              <h3>{section.name}</h3>
              <p>{section.description}</p>
              <Link className="section-link" href={section.href}>{section.action} <span aria-hidden="true">→</span></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="home-products" aria-labelledby="home-products-title">
        <div className="section-heading section-heading-split">
          <div>
            <p className="eyebrow">Marketplace</p>
            <h2 id="home-products-title">Discover what&apos;s on HolyHub.</h2>
          </div>
          <Link className="section-link inline-section-link" href="/marketplace">See all products <span aria-hidden="true">→</span></Link>
        </div>

        {homepageDemoProducts.length > 0 && (
          <div className="demo-preview-banner">
            <strong>Marketplace preview</strong>
            <span>Demo products are filling the empty spaces so you can see the finished marketplace vibe.</span>
          </div>
        )}

        <div className="home-product-grid">
          {realProducts.map((product) => {
            const storefront = Array.isArray(product.lister_storefronts) ? product.lister_storefronts[0] : product.lister_storefronts;
            return (
              <Link className="home-product-card" href={`/products/${product.id}`} key={product.id}>
                <div className="home-product-image">
                  {product.image_url ? <img src={product.image_url} alt={product.name} /> : <div className="product-placeholder">HolyHub</div>}
                  <span>{product.category_type}</span>
                </div>
                <div className="home-product-copy">
                  <small>{storefront?.business_name ?? "HolyHub lister"}</small>
                  <h3>{product.name}</h3>
                  <strong>£{Number(product.price).toFixed(2)}</strong>
                </div>
              </Link>
            );
          })}

          {homepageDemoProducts.map((product) => (
            <article className="home-product-card demo-product-card" key={product.id}>
              <div className="home-product-image">
                <img src={product.image_url} alt="" />
                <span>{product.category_type}</span>
              </div>
              <div className="home-product-copy">
                <small>{product.listerName} · DEMO</small>
                <h3>{product.name}</h3>
                <strong>£{product.price.toFixed(2)}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-cta">
        <div>
          <p className="eyebrow">Start discovering</p>
          <h2>Christian brands, community and events — together.</h2>
          <p>Marketplace is live now, with The Hub and Events growing alongside it.</p>
        </div>
        <Link className="button button-primary button-large" href="/auth/signup">Join HolyHub <span aria-hidden="true">→</span></Link>
      </section>
    </div>
  );
}
