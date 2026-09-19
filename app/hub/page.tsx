import Link from "next/link";

const hubAreas = [
  {
    title: "Bible",
    description: "Read and explore the Bible from inside The Hub.",
    href: "/hub/bible",
    action: "Open Bible",
    icon: "✦",
    live: true,
  },
  {
    title: "Community",
    description: "Connect with other Christians and discover what is happening across the wider community.",
    href: null,
    action: "Coming soon",
    icon: "♡",
    live: false,
  },
  {
    title: "Opportunities",
    description: "Discover ways to serve, join in, learn and get involved.",
    href: null,
    action: "Coming soon",
    icon: "↗",
    live: false,
  },
  {
    title: "Conversations",
    description: "Future spaces for discussion, encouragement and meaningful connection.",
    href: null,
    action: "Coming soon",
    icon: "○",
    live: false,
  },
];

export default function HubPage() {
  return (
    <div className="section-landing hub-landing">
      <section className="section-hero section-hero-refresh">
        <div className="section-hero-copy">
          <div className="hero-kicker"><span className="hero-kicker-dot" /> Faith lives here</div>
          <p className="eyebrow">The Hub</p>
          <h1>Your space to connect, reflect and grow.</h1>
          <p className="lead">
            Bible, community, opportunities and conversations — brought together in one calm Christian space.
          </p>
          <div className="button-row">
            <Link className="button button-primary button-large" href="/hub/bible">Open Bible <span aria-hidden="true">→</span></Link>
            <Link className="button button-quiet button-large" href="/marketplace">Explore Marketplace</Link>
          </div>
        </div>

        <div className="hub-hero-card" aria-hidden="true">
          <span className="hub-hero-card-label">INSIDE THE HUB</span>
          <div className="hub-verse-mark">✦</div>
          <p>Read. Connect. Discover. Grow.</p>
          <div className="hub-hero-card-row"><span>Bible</span><strong>Available</strong></div>
          <div className="hub-hero-card-row"><span>Community</span><em>Coming soon</em></div>
          <div className="hub-hero-card-row"><span>Opportunities</span><em>Coming soon</em></div>
        </div>
      </section>

      <section className="preview-section">
        <div className="section-heading section-heading-split">
          <div>
            <p className="eyebrow">Inside The Hub</p>
            <h2>Made for faith, community and growth.</h2>
          </div>
          <p>Start with the Bible today. More ways to connect will be added as HolyHub grows.</p>
        </div>
        <div className="preview-grid hub-preview-grid">
          {hubAreas.map((area) => (
            <article className={`preview-card engaging-card ${area.live ? "preview-card-live" : ""}`} key={area.title}>
              <div className="preview-card-top">
                <span className="preview-icon" aria-hidden="true">{area.icon}</span>
                <span className={area.live ? "live-pill" : "soft-pill"}>{area.live ? "OPEN" : "SOON"}</span>
              </div>
              <h3>{area.title}</h3>
              <p>{area.description}</p>
              {area.href ? (
                <Link className="section-link" href={area.href}>{area.action} <span aria-hidden="true">→</span></Link>
              ) : (
                <span className="section-link section-link-muted">{area.action}</span>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
