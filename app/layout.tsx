import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import Link from "next/link";

export const metadata: Metadata = {
  title: { default: "HolyHub — Connect. Discover. Grow.", template: "%s | HolyHub" },
  description: "Discover Christian brands, businesses, creators and events. Connect. Discover. Grow.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <SiteHeader />
        <main id="main" className="page-shell">{children}</main>
        <footer className="site-footer"><p><strong>HolyHub</strong><span>Connect. Discover. Grow.</span></p><nav aria-label="Footer"><Link href="/account/business">Become a Lister</Link><Link href="/privacy">Privacy</Link><a href="mailto:Official.holyhub@gmail.com">Contact</a></nav></footer>
      </body>
    </html>
  );
}
