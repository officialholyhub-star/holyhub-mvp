import Link from "next/link";

export default function HomePage() {
  return (
    <section className="hero">
      <p className="eyebrow">HolyHub</p>
      <h1>Connect. Discover. Grow.</h1>
      <p className="lead">
        One place to discover and support Christian brands. Create your HolyHub account to get started.
      </p>
      <div className="button-row">
        <Link className="button button-primary" href="/marketplace">Browse marketplace</Link>
        <Link className="button button-primary" href="/auth/signup">Create account</Link>
        <Link className="button button-quiet" href="/auth/login">Log in</Link>
      </div>
    </section>
  );
}
