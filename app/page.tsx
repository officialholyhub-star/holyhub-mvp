import Link from "next/link";

const sections = [
  {
    name: "The Hub",
    status: "Coming soon",
    description: "Connect with the Christian community, faith content, opportunities and conversations.",
    href: "/hub",
    action: "Explore the Hub",
    className: "home-section-card hub-card",
  },
  {
    name: "Marketplace",
    status: "Available now",
    description: "Discover and support Christian brands, products and independent listers in one place.",
    href: "/marketplace",
    action: "Shop Marketplace",
    className: "home-section-card marketplace-card-home",
  },
  {
    name: "Events",
    status: "Coming soon",
    description: "Find Christian events, conferences, worship nights, festivals and activities.",
    href: "/events",
    action: "Explore Events",
    className: "home-section-card events-card",
  },
];

export default function HomePage() {
  return (
    <div className="home-page">
      <section className="home-hero">
        <p className="eyebrow">HolyHub</p>
        <h1>Connect. Discover. Grow.</h1>
        <p className="lead">
          One place for Christian community, brands and events. Start by exploring the Marketplace while The Hub and Events continue to grow.
        </p>
        <div className="button-row">
          <Link className="button button-primary" href="/marketplace">Shop Marketplace</Link>
          <Link className="button button-quiet" href="/auth/signup">Join HolyHub</Link>
        </div>
      </section>

      <section className="home-sections" aria-labelledby="holyhub-sections-title">
        <div className="section-heading">
          <p className="eyebrow">Three parts. One HolyHub.</p>
          <h2 id="holyhub-sections-title">Choose where you want to go</h2>
        </div>

        <div className="home-section-grid">
          {sections.map((section) => (
            <article className={section.className} key={section.name}>
              <span className="section-status">{section.status}</span>
              <h3>{section.name}</h3>
              <p>{section.description}</p>
              <Link className="section-link" href={section.href}>{section.action} <span aria-hidden="true">→</span></Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
