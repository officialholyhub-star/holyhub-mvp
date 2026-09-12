"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function MarketNav({ area = "customer" }: { area?: "customer" | "seller" | "admin" }) {
  const pathname = usePathname();
  const isCurrent = (href:string) => pathname === href || (
    !["/account","/seller","/admin"].includes(href) && pathname.startsWith(href + "/")
  ) || (href === "/admin/marketplace" && pathname.startsWith("/admin/orders/"));
  const links = area === "seller" ? [["/seller","Overview"],["/seller/products","Products"],["/seller/orders","Orders"],["/seller/finances","Earnings"],["/account/business","Storefront"]] : area === "admin" ? [["/admin","Applications"],["/admin/marketplace","Marketplace"],["/admin/refunds","Refund reviews"],["/admin/settings","Settings"],["/admin/audit","Activity"]] : [["/account","Account"],["/orders","My orders"],["/basket","Basket"],["/notifications","Notifications"],["/seller","Seller hub"]];
  return <nav className="market-nav" aria-label={`${area} navigation`}>{links.map(([href,label])=><Link href={href} key={href} aria-current={isCurrent(href)?"page":undefined}>{label}</Link>)}</nav>;
}
