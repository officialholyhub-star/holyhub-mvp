import Link from "next/link";

const eventTypes = [
  { title: "Conferences", description: "Gather, learn and connect.", icon: "✦" },
  { title: "Worship nights", description: "Evenings of worship and prayer.", icon: "♪" },
  { title: "Festivals", description: "Bigger Christian experiences.", icon: "○" },
  { title: "Activities", description: "Local groups, meet-ups and opportunities.", icon: "↗" },
];

export default function EventsPage() {
  return (
    <div className="section-landing events-landing">
      <section className="section-hero section-hero-refresh">
        <div className="section-hero-copy">
          <div className="hero-kicker"><span className="hero-kicker-dot hero-kicker-dot-pink" /> Something to look forward to</div>
          <p className="eyebrow">HolyHub Events</p>
          <h1>Find the moments that bring people together.</h1>
          <p className="lead">
            A simpler way to discover Christian events, activities and opportunities — all in one place.
          </p>
          <div className="button-row">
            <Link className="button button-primary button-large" href="/marketplace">Explore Marketplace</Link>
            <Link className="button button-quiet button-large" href="/hub">Visit The Hub</Link>
          </div>
        </div>

        <div className="event-ticket-stack" aria-hidden="true">
          <div className="event-ticket event-ticket-back">
            <small>COMING SOON</small>
            <strong>Worship Nights</strong>
            <span>Discover together</span>
          </div>
          <div className="event-ticket event-ticket-front">
            <div className="ticket-top"><span>HOLYHUB</span><span>EVENTS</span></div>
            <div>
              <small>DISCOVER</small>
              <strong>Christian events<br />in one place.</strong>
            </div>
            <div className="ticket-dots"><i /><i /><i /><i /><i /></div>
          </div>
        </div>
      </section>

      <section className="preview-section">
        <div className="section-heading section-heading-split">
          <div>
            <p className="eyebrow">What you&apos;ll discover</p>
            <h2>More reasons to get out and connect.</h2>
          </div>
          <p>From local worship nights to larger festivals, HolyHub Events is designed to make discovery easier.</p>
        </div>
        <div className="preview-grid">
          {eventTypes.map((item) => (
            <article className="preview-card engaging-card" key={item.title}>
              <div className="preview-card-top">
                <span className="preview-icon event-preview-icon" aria-hidden="true">{item.icon}</span>
                <span className="soft-pill">SOON</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
