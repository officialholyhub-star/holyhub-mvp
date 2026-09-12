import Link from "next/link";
export default function NotFound() {
  return <section className="content-narrow empty-state card"><p className="eyebrow">A different direction</p><h1 className="page-title">This page isn’t here.</h1><p>The link may have changed, or this listing isn’t published.</p><Link href="/businesses" className="button button-primary">Explore businesses →</Link></section>;
}
