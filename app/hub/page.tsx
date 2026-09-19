import Link from "next/link";

const hubAreas = [
  {
    title: "Bible",
    description: "Read and explore the Bible from inside The Hub.",
    href: "/hub/bible",
    action: "Open Bible",
  },
  {
    title: "Community",
    description: "A place to connect with other Christians and discover what is happening across the wider community.",
    href: null,
    action: "Coming soon",
  },
  {
    title: "Opportunities",
    description: "Discover ways to serve, join in, learn and get involved.",
    href: null,
    action: "Coming soon",
  },
  {
    title: "Conversations",
    description: "Future community features for discussions, encouragement and connection.",
    href: null,
    action: "Coming soon",
  },
];

export default function HubPage() {
  return (
    <div className="section-landing hub-landing">
      <section className="section-hero">
        <div>
          <p className="eyebrow">The HolyHub Hub</p>
          <span className="section-status">Growing now</span>
          <h1>A space to connect and grow.</h1>
          <p className="lead">
            The Hub brings faith content, community and opportunities together in one place — including access to the Bible.
          </p>
          <div className="button-row">
            <Link className="button button-primary" href="/hub/bible">Open Bible</Link>
            <Link className="button button-quiet" href="/marketplace">Explore Marketplace</Link>
          </div>
        </div>
      </section>

      <section className="preview-section">
        <div className="section-heading">
          <p className="eyebrow">Inside The Hub</p>
          <h2>Faith, community and growth</h2>
        </div>
        <div className="preview-grid">
          {hubAreas.map((area) => (
            <article className="preview-card" key={area.title}>
              <h3>{area.title}</h3>
              <p>{area.description}</p>
              {area.href ? (
                <Link className="section-link" href={area.href}>{area.action} <span aria-hidden="true">→</span></Link>
              ) : (
                <span className="muted-small">{area.action}</span>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
