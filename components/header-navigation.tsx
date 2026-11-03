"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/products", label: "Discover", paths: ["/products", "/businesses"] },
  { href: "/events", label: "Events", paths: ["/events"] },
  { href: "/hub", label: "The Hub", paths: ["/hub"] },
  { href: "/account/business", label: "List your business", paths: ["/account/business", "/seller"] },
];

export function HeaderNavigation() {
  const pathname = usePathname();
  return <div className="header-primary">{links.map(link => <Link key={link.href} href={link.href} className="nav-link" aria-current={link.paths.some(path => pathname === path || pathname.startsWith(`${path}/`)) ? "page" : undefined}>{link.label}</Link>)}</div>;
}
