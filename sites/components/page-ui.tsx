import Link from "@/components/site-link";
export function Saved({value}:{value?:string}){return value==="1"?<p className="notice notice-success" role="status">Your changes have been saved.</p>:null;}
export function Empty({title,children}:{title:string;children:React.ReactNode}){return <div className="empty-state card"><h2>{title}</h2>{children}</div>;}
export function AccountNav(){return <nav className="market-nav" aria-label="Account navigation"><Link href="/account">My account</Link><Link href="/account/business">Your business</Link><Link href="/seller/products">Your products</Link><Link href="/notifications">Updates</Link></nav>;}
export function AdminNav(){return <nav className="market-nav" aria-label="Admin navigation"><Link href="/admin">Applications</Link><Link href="/admin/products">Products</Link><Link href="/admin/events">Events</Link><Link href="/admin/members">Accounts</Link><Link href="/admin/audit">Activity</Link></nav>;}
