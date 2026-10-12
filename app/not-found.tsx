import Link from "next/link";
export default function NotFound() {
  return <section className="auth-wrap"><div className="card"><h1>This page is unavailable</h1><p>The page or listing may have moved or is no longer available.</p><Link className="button button-primary" href="/marketplace">Browse marketplace</Link> <Link className="text-link" href="/account">Return to account</Link> <Link className="text-link" href="/contact">Contact HolyHub</Link></div></section>;
}
