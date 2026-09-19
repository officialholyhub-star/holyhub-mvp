import Link from "next/link";
import { HOLYHUB_LEGAL } from "@/lib/legal";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <strong>HolyHub</strong>
          <span>Connect. Discover. Grow.</span>
          <small>{HOLYHUB_LEGAL.operator}</small>
        </div>
        <nav className="footer-links" aria-label="HolyHub legal and support">
          <Link href="/terms">Terms</Link>
          <Link href="/lister-terms">Lister Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/cookies">Cookies</Link>
          <Link href="/shipping">Shipping</Link>
          <Link href="/returns">Returns</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <a className="footer-email" href={`mailto:${HOLYHUB_LEGAL.email}`}>{HOLYHUB_LEGAL.email}</a>
      </div>
    </footer>
  );
}
