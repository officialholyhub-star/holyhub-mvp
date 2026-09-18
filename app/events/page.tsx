import Link from "next/link";

const eventTypes = [
  ["Conferences", "Discover gatherings designed to teach, equip and connect."],
  ["Worship nights", "Find evenings of worship, prayer and community."],
  ["Festivals", "Explore larger Christian festivals and experiences."],
  ["Activities", "Discover local groups, meet-ups and other opportunities."],
];

export default function EventsPage() {
  return (
    <div className="section-landing events-landing">
      <section className="section-hero">
        <div>
          <p className="eyebrow">HolyHub Events</p>
          <span className="section-status">Coming soon</span>
          <h1>Find Christian events in one place.</h1>
          <p className="lead">
            HolyHub Events is being built to make Christian events, activities and opportunities easier to discover.
          </p>
          <div className="button-row">
            <Link className="button button-primary" href="/marketplace">Explore Marketplace</Link>
            <Link className="button button-quiet" href="/hub">Visit The Hub</Link>
          </div>
        </div>
      </section>

      <section className="preview-section">
        <div className="section-heading">
          <p className="eyebrow">What you&apos;ll discover</p>
          <h2>Events for different parts of Christian life</h2>
        </div>
        <div className="preview-grid">
          {eventTypes.map(([title, description]) => (
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
