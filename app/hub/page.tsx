import Link from "next/link";
import { HolyHubIcon } from "@/components/holyhub-icon";\nimport { VerseOfTheDay } from "@/components/verse-of-the-day";

export const dynamic = "force-dynamic";\n\nconst hubAreas = [
  {
    title: "Bible",
    description: "The Bible reader is being moved into The Hub so faith content stays in one clear place.",
    href: "/hub/bible",
    action: "Preview Bible",
    icon: "bible" as const,
    status: "SOON",
  },
  {
    title: "Community",
    description: "Connect with other Christians and discover what is happening across the wider community.",
    href: null,
    action: "Coming soon",
    icon: "community" as const,
    status: "SOON",
  },
  {
    title: "Opportunities",
    description: "Discover ways to serve, join in, learn and get involved.",
    href: null,
    action: "Coming soon",
    icon: "opportunities" as const,
    status: "SOON",
  },
  {
    title: "Conversations",
    description: "Future spaces for discussion, encouragement and meaningful connection.",
    href: null,
    action: "Coming soon",
    icon: "conversations" as const,
    status: "SOON",
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
            <Link className="button button-primary button-large" href="/marketplace">Explore Marketplace <span aria-hidden="true">→</span></Link>
            <Link className="button button-quiet button-large" href="/hub/bible">Preview Bible</Link>
          </div>
        </div>

        <div className="hub-hero-card" aria-hidden="true">
          <span className="hub-hero-card-label">INSIDE THE HUB</span>
          <div className="hub-verse-mark"><HolyHubIcon name="hub" /></div>
          <p>Read. Connect. Discover. Grow.</p>
          <div className="hub-hero-card-row"><span>Bible</span><em>Coming soon</em></div>
          <div className="hub-hero-card-row"><span>Community</span><em>Coming soon</em></div>
          <div className="hub-hero-card-row"><span>Opportunities</span><em>Coming soon</em></div>
        </div>
      </section>

      <VerseOfTheDay />\n\n      <section className="preview-section">
        <div className="section-heading section-heading-split">
          <div>
            <p className="eyebrow">Inside The Hub</p>
            <h2>Made for faith, community and growth.</h2>
          </div>
          <p>The structure is here now. Each feature will open as it is ready, starting with the Bible reader.</p>
        </div>
        <div className="preview-grid hub-preview-grid">
          {hubAreas.map((area) => (
            <article className="preview-card engaging-card" key={area.title}>
              <div className="preview-card-top">
                <span className="preview-icon" aria-hidden="true"><HolyHubIcon name={area.icon} /></span>
                <span className="soft-pill">{area.status}</span>
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
