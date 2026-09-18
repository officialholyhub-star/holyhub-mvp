import Link from "next/link";

const hubAreas = [
  ["Community", "A place to connect with other Christians and discover what is happening across the wider community."],
  ["Faith content", "Bible and faith-focused content designed to help people grow."],
  ["Opportunities", "Discover ways to serve, join in, learn and get involved."],
  ["Conversations", "Future community features for discussions, encouragement and connection."],
];

export default function HubPage() {
  return (
    <div className="section-landing hub-landing">
      <section className="section-hero">
        <div>
          <p className="eyebrow">The HolyHub Hub</p>
          <span className="section-status">Coming soon</span>
          <h1>A space to connect and grow.</h1>
          <p className="lead">
            The Hub will bring Christian community, faith content, opportunities and conversations together in one simple place.
          </p>
          <div className="button-row">
            <Link className="button button-primary" href="/marketplace">Explore Marketplace</Link>
            <Link className="button button-quiet" href="/events">Explore Events</Link>
          </div>
        </div>
      </section>

      <section className="preview-section">
        <div className="section-heading">
          <p className="eyebrow">Built for connection</p>
          <h2>What The Hub is growing into</h2>
        </div>
        <div className="preview-grid">
          {hubAreas.map(([title, description]) => (
            <article className="preview-card" key={title}>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
