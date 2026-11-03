"use client";
import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="content-narrow empty-state card" role="alert"><p className="eyebrow">A little pause</p><h1 className="page-title">We couldn’t load this just now.</h1><p>Your connection or our service may be temporarily unavailable. Please try again.</p><div className="button-row"><button className="button button-primary" onClick={reset}>Try again</button><Link href="/" className="button button-quiet">Back to HolyHub</Link></div><p>Still having trouble? <a className="text-link" href="mailto:Official.holyhub@gmail.com">Contact HolyHub</a>.</p></section>;
}
