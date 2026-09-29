import { HolyHubIcon } from "@/components/holyhub-icon";

const eventTypes = [
  {
    title: "Socials & meetups",
    description: "Brunches, games and community.",
    icon: "community" as const,
  },
  {
    title: "Retreats & getaways",
    description: "Time away to rest and reconnect.",
    icon: "activity" as const,
  },
  {
    title: "Food & fellowship",
    description: "Meals, brunches and shared tables.",
    icon: "community" as const,
  },
  {
    title: "Conferences & talks",
    description: "Ideas, stories and space to grow.",
    icon: "conference" as const,
  },
  {
    title: "Family & kids",
    description: "Days out for every generation.",
    icon: "activity" as const,
  },
  {
    title: "Worship experiences",
    description: "Worship, prayer and live gatherings.",
    icon: "worship" as const,
  },
];

export default function EventsPage() {
  return (
    <div className="section-landing events-landing">
      <section className="section-hero section-hero-refresh">
        <div className="section-hero-copy">
          <div className="hero-kicker hero-kicker-soon">
            <span className="hero-kicker-dot hero-kicker-dot-pink" /> Coming soon
          </div>
          <p className="eyebrow">HolyHub Events</p>
          <h1>Find the moments that bring people together.</h1>
        </div>

        <div className="event-ticket-stack" aria-hidden="true">
          <div className="event-ticket event-ticket-back">
            <small>COMING SOON</small>
            <strong>Something for everyone</strong>
            <span>Discover together</span>
          </div>
          <div className="event-ticket event-ticket-front">
            <div className="ticket-top">
              <span>HOLYHUB</span>
              <span>EVENTS</span>
            </div>
            <div>
              <small>DISCOVER</small>
              <strong>
                More ways to
                <br />
                come together.
              </strong>
            </div>
            <div className="ticket-dots">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
      </section>

      <section className="preview-section">
        <div className="section-heading section-heading-split">
          <div>
            <p className="eyebrow">What you&apos;ll discover</p>
            <h2>More reasons to get out and connect.</h2>
          </div>
          <p>A mix of experiences for faith, friendship, family and fun.</p>
        </div>

        <div className="preview-grid">
          {eventTypes.map((item) => (
            <article className="preview-card engaging-card" key={item.title}>
              <div className="preview-card-top">
                <span className="preview-icon event-preview-icon" aria-hidden="true">
                  <HolyHubIcon name={item.icon} />
                </span>
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
