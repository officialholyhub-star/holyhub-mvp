import Link from "next/link";
import { categories } from "@/lib/businesses";

export default function HomePage() {
  return <>
    <section className="home-hero">
      <div className="hero-copy"><p className="eyebrow">Connect. Discover. Grow.</p><h1>Where Christian brands, events & <span className="accent-word">community</span> meet.</h1><p className="lead">Discover exciting Christian brands. Find events worth showing up for. Be part of the community.</p><div className="button-row"><Link className="button button-primary" href="/businesses">Explore businesses <span aria-hidden="true">→</span></Link><Link className="button button-quiet" href="/account/business">Become a Lister <span aria-hidden="true">→</span></Link></div><p className="hero-note">Good things happen when we support one another.</p></div>
      <aside className="community-panel"><span className="panel-star" aria-hidden="true">✦</span><p className="eyebrow">A little discovery.<br />A lot of possibility.</p><h2>Your next favourite<br />could be right here.</h2><div className="category-tiles">{[{ name: "Christian Brands", icon: "✦" }, { name: "Art & Creators", icon: "✳" }, { name: "Events", icon: "♡" }, { name: "Food & Drink", icon: "✧" }].map(item => <Link href={`/businesses?category=${encodeURIComponent(item.name)}`} key={item.name}><span aria-hidden="true">{item.icon}</span><strong>{item.name}</strong><span aria-hidden="true">→</span></Link>)}</div><p>Rooted in faith. Open to discovery.</p></aside>
    </section>
    <nav className="category-strip" aria-label="Explore by category"><span>Find your thing</span>{categories.map(category => <Link key={category} href={`/businesses?category=${encodeURIComponent(category)}`}>{category}</Link>)}</nav>
  </>;
}
