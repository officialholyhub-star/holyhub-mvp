import Link from "next/link";

export default function HubBiblePage() {
  return (
    <div className="section-landing">
      <section className="section-hero hub-bible-hero">
        <div>
          <p className="eyebrow">The Hub · Bible</p>
          <span className="section-status">Coming soon</span>
          <h1>Bible</h1>
          <p className="lead">
            The Bible will live inside The Hub so faith content stays part of the wider HolyHub community experience.
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
