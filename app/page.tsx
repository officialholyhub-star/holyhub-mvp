import Link from "next/link";

const sections = [
  {
    number: "01",
    name: "The Hub",
    status: "Growing now",
    description: "Bible, community, opportunities and faith-focused spaces designed to help you connect and grow.",
    href: "/hub",
    action: "Enter The Hub",
    className: "home-section-card hub-card",
  },
  {
    number: "02",
    name: "Marketplace",
    status: "Live",
    description: "Discover Christian brands, products and independent listers — all in one place.",
    href: "/marketplace",
    action: "Shop Marketplace",
    className: "home-section-card marketplace-card-home featured-section-card",
  },
  {
    number: "03",
    name: "Events",
    status: "Coming soon",
    description: "Find worship nights, conferences, festivals, activities and Christian experiences.",
    href: "/events",
    action: "Explore Events",
    className: "home-section-card events-card",
  },
];

export default function HomePage() {
  return (
    <div className="home-page">
      <section className="home-hero home-hero-refresh">
        <div className="home-hero-copy">
          <div className="hero-kicker"><span className="hero-kicker-dot" /> One place. Three ways to connect.</div>
          <p className="eyebrow">HolyHub</p>
          <h1>Connect. Discover. <span>Grow.</span></h1>
          <p className="lead">
            A Christian platform bringing community, brands and events together in one simple place.
          </p>
          <div className="button-row">
            <Link className="button button-primary button-large" href="/marketplace">Explore Marketplace <span aria-hidden="true">→</span></Link>
            <Link className="button button-quiet button-large" href="/hub">Enter The Hub</Link>
          </div>
          <div className="hero-mini-nav" aria-label="HolyHub areas">
            <span>The Hub</span><i />
            <span>Marketplace</span><i />
            <span>Events</span>
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="hero-orb hero-orb-blue" />
          <div className="hero-orb hero-orb-pink" />
          <div className="hero-stack-card hero-stack-hub">
            <span className="hero-stack-icon">✦</span>
            <div><small>CONNECT</small><strong>The Hub</strong></div>
          </div>
          <div className="hero-stack-card hero-stack-market">
            <span className="hero-stack-icon">♡</span>
            <div><small>DISCOVER</small><strong>Marketplace</strong></div>
            <span className="live-pill">LIVE</span>
          </div>
          <div className="hero-stack-card hero-stack-events">
            <span className="hero-stack-icon">○</span>
            <div><small>GROW</small><strong>Events</strong></div>
          </div>
        </div>
      </section>

      <section className="home-sections" aria-labelledby="holyhub-sections-title">
        <div className="section-heading section-heading-split">
          <div>
            <p className="eyebrow">Explore HolyHub</p>
            <h2 id="holyhub-sections-title">Everything has its place.</h2>
          </div>
          <p>Move between faith, shopping and experiences without leaving HolyHub.</p>
        </div>

        <div className="home-section-grid">
          {sections.map((section) => (
            <article className={section.className} key={section.name}>
              <div className="section-card-top">
                <span className="section-number">{section.number}</span>
                <span className="section-status">{section.status}</span>
              </div>
              <div className="section-card-icon" aria-hidden="true">
                {section.name === "The Hub" ? "✦" : section.name === "Marketplace" ? "♡" : "○"}
              </div>
              <h3>{section.name}</h3>
              <p>{section.description}</p>
              <Link className="section-link" href={section.href}>{section.action} <span aria-hidden="true">→</span></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="home-cta">
        <div>
          <p className="eyebrow">Start discovering</p>
          <h2>Christian brands are already waiting.</h2>
          <p>Marketplace is the first part of HolyHub available to explore now.</p>
        </div>
        <Link className="button button-primary button-large" href="/marketplace">Browse Marketplace <span aria-hidden="true">→</span></Link>
      </section>
    </div>
  );
}
