import { readAllRows } from "@/lib/read-all-rows";
import { listerReadiness } from "@/lib/admin-listers";
import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { supabase } = await requireRole("admin");
  const [{ count: applicationCount, error: applicationError }, { count: productCount, error: productError }, preparing, processing, returned, applications, roles, shops, products] = await Promise.all([
    supabase.from("lister_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("review_status", "pending"),
    supabase.from("seller_orders").select("id", { count: "exact", head: true }).eq("fulfilment_status", "pending"),
    supabase.from("seller_orders").select("id", { count: "exact", head: true }).eq("fulfilment_status", "packed"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("review_status", "rejected"),
    readAllRows(offset => supabase.from("lister_applications").select("id, user_id").eq("status", "approved").order("id").range(offset, offset + 999)),
    readAllRows(offset => supabase.from("user_roles").select("user_id").eq("role", "lister").order("user_id").range(offset, offset + 999)),
    readAllRows(offset => supabase.from("lister_storefronts").select("user_id").order("user_id").range(offset, offset + 999)),
    readAllRows(offset => supabase.from("products").select("id, lister_user_id, review_status, is_published").order("id").range(offset, offset + 999)),
  ]);

  const applicationUnavailable = Boolean(applicationError) || applicationCount == null;
  const productUnavailable = Boolean(productError) || productCount == null;

  const readinessUnavailable = Boolean(applications.error || roles.error || shops.error || products.error);
  const readiness = readinessUnavailable ? null : listerReadiness(applications.data ?? [], roles.data ?? [], shops.data ?? [], products.data ?? []);
  return (
    <section className="admin-workspace">
      <div className="admin-workspace-header">
        <div>
          <p className="eyebrow">HolyHub admin</p>
          <h1>Keep the marketplace moving.</h1>
          <p className="lead">Review sellers and listings, check fulfilment and see shop readiness.</p>
        </div>
        <span className="admin-summary">{applicationUnavailable || productUnavailable ? "Review counts unavailable" : `${(applicationCount ?? 0) + (productCount ?? 0)} reviews waiting`}</span>
      </div>
      <nav className="admin-tabs" aria-label="Admin workspace">
        <Link href="/admin/security">Account security</Link>
        <Link className="is-active" href="/admin" aria-current="page">Overview</Link>
        <Link href="/admin/orders">Orders</Link>
        <Link href="/admin/analytics">Launch metrics</Link>
        <Link href="/admin/applications">Lister Applications {!applicationUnavailable && applicationCount ? <strong>{applicationCount}</strong> : null}</Link>
        <Link href="/admin/listers">Listers</Link>
        <Link href="/admin/products">Product Listings {!productUnavailable && productCount ? <strong>{productCount}</strong> : null}</Link>
      </nav>
      <div className="admin-overview-grid">
        <Link className="admin-overview-card admin-overview-card-primary" href="/admin/products">
          <span className="admin-card-kicker">Product listings</span>
          <strong>{productUnavailable ? "Unavailable" : productCount ?? 0}</strong>
          <h2>{productUnavailable ? "Couldn’t load this queue. Refresh to try again." : productCount ? "Listings need your review" : "No listings waiting"}</h2>
          <p>{productUnavailable ? "Couldn’t load this queue. Refresh to try again." : productCount ? "Open the queue to review the next product." : "New submissions will appear here."}</p>
          <span className="admin-card-link">Open product queue <span aria-hidden="true">→</span></span>
        </Link>
        <Link className="admin-overview-card" href="/admin/applications">
          <span className="admin-card-kicker">Lister applications</span>
          <strong>{applicationUnavailable ? "Unavailable" : applicationCount ?? 0}</strong>
          <h2>{applicationUnavailable ? "Couldn’t load this queue. Refresh to try again." : applicationCount ? "Applications need your review" : "No applications waiting"}</h2>
          <p>{applicationUnavailable ? "Couldn’t load this queue. Refresh to try again." : applicationCount ? "Approve trusted sellers or request more information." : "You are all caught up for now."}</p>
          <span className="admin-card-link">Open application queue <span aria-hidden="true">→</span></span>
        </Link>
        {[{ result: preparing, title: "Needs preparing", href: "/admin/orders?status=pending" }, { result: processing, title: "Processing · awaiting dispatch", href: "/admin/orders?status=packed" }].map(({ result, title, href }) => <Link className="admin-overview-card" href={href} key={href}>
          <span className="admin-card-kicker">Orders & fulfilment</span><strong>{result.error || result.count == null ? "Unavailable" : result.count}</strong><h2>{title}</h2>
          <p>{result.error || result.count == null ? "Count could not be loaded. Refresh to try again." : "Lister portions with this recorded fulfilment status. A customer order may include several portions."}</p><span className="admin-card-link">View order portions →</span>
        </Link>)}
        <Link className="admin-overview-card" href="/admin/products?status=rejected"><span className="admin-card-kicker">Returned products</span><strong>{returned.error || returned.count == null ? "Unavailable" : returned.count}</strong><h2>Changes requested from listers</h2><p>{returned.error || returned.count == null ? "Count could not be loaded. Refresh to try again." : "View existing feedback. These products need lister edits before another review."}</p><span className="admin-card-link">View returned products →</span></Link>
        <Link className="admin-overview-card" href="/admin/listers"><span className="admin-card-kicker">Lister readiness</span><strong>{readiness ? readiness.total : "Unavailable"}</strong><h2>Approved applications / lister access</h2>{readiness ? <p>{readiness.setupNeeded} need shop setup · {readiness.notLive} shops have no live products · {readiness.live} shops have live products</p> : <p>Readiness could not be loaded. Refresh to try again.</p>}<span className="admin-card-link">View listers →</span></Link>
        <Link className="admin-overview-card" href="/admin/analytics"><span className="admin-card-kicker">Launch measurement</span><strong>Core</strong><h2>Checkout & order metrics</h2><p>Check recorded checkout conversion, order value, commission, Stripe fee coverage and fulfilment states.</p><span className="admin-card-link">Open launch metrics →</span></Link>
      </div>
      <p className="muted-small">Refund tools are not available here. This overview does not detect overdue orders or refund issues.</p>
    </section>
  );
}
