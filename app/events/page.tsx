const eventTypes = [
  { title: "Socials & Meetups", description: "Meet, connect and belong." },
  { title: "Retreats & Getaways", description: "Rest, reflect and reconnect." },
  { title: "Food & Fellowship", description: "Share meals and community." },
  { title: "Conferences & Talks", description: "Gather, learn and grow." },
  { title: "Family & Kids", description: "Find something for every generation." },
  { title: "Worship Experiences", description: "Worship, prayer and live gatherings." },
];

export default function EventsPage() {
  return (
    <div className="events-minimal">
      <section className="preview-section events-options">
        <div className="compact-coming-soon"><span className="availability-badge">COMING SOON</span><span>Events are being prepared.</span></div>
        <div className="section-heading section-heading-split">
          <div>
            <p className="eyebrow">HolyHub Events</p>
            <h1>Find ways to gather.</h1>
          </div>
        </div>
        <div className="preview-grid">
          {eventTypes.map((item) => (
            <article className="preview-card engaging-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

    </div>
  );
}
