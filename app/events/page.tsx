import Link from "next/link";

export default function EventsPage() {
  return (
    <section className="hero">
      <p className="eyebrow">HolyHub events</p>
      <h1>Discover Christian events</h1>
      <p className="lead">
        We&apos;re building one place to discover Christian events, activities and opportunities. Events are coming soon.
      </p>
      <div className="button-row">
        <Link className="button button-primary" href="/marketplace">Shop the marketplace</Link>
        <Link className="button button-quiet" href="/">Back to home</Link>
      </div>
    </section>
  );
}
