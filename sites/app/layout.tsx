import type { Metadata } from "next";
import Link from "@/components/site-link";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "HolyHub — Connect. Discover. Grow.", template: "%s | HolyHub" }, description: "Discover independent Christian brands, businesses, creators and events. List your business and grow with HolyHub.", icons: { icon: "/holyhub-logo.png" } };
export default function RootLayout({children}:{children:React.ReactNode}) {
 return <html lang="en-GB"><body><a href="#main" className="skip-link">Skip to content</a><SiteHeader/><main id="main" className="page-shell">{children}</main><footer className="site-footer"><p><strong>HolyHub</strong><span>Connect. Discover. Grow.</span></p><nav aria-label="Footer"><Link href="/account/business">Become a Lister</Link><Link href="/privacy">Privacy</Link><a href="mailto:Official.holyhub@gmail.com">Contact</a></nav></footer></body></html>;
}
