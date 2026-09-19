import Link from "next/link";
import { HolyHubIcon } from "@/components/holyhub-icon";

export default function HubBiblePage() {
  return (
    <div className="section-landing bible-landing">
      <section className="section-hero hub-bible-hero">
        <div>
          <div className="hero-kicker"><span className="hero-kicker-dot" /> Inside The Hub</div>
          <p className="eyebrow">The Hub · Bible</p>
          <span className="section-status">Coming soon</span>
          <div className="bible-page-icon"><HolyHubIcon name="bible" /></div>
          <h1>Bible</h1>
          <p className="lead">
            The Bible reader is being moved into The Hub. When it is ready, this will be the one place you enter it from.
          </p>
          <div className="button-row">
            <Link className="button button-primary" href="/hub">Back to The Hub</Link>
            <Link className="button button-quiet" href="/marketplace">Explore Marketplace</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
