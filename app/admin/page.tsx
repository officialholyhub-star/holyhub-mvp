import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { supabase } = await requireRole("admin");
  const [{ count: applicationCount }, { count: productCount }] = await Promise.all([
    supabase.from("lister_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("review_status", "pending"),
  ]);

  return (
    <section className="admin-workspace">
      <div className="admin-workspace-header">
        <div>
          <p className="eyebrow">HolyHub admin</p>
          <h1>Keep the marketplace moving.</h1>
          <p className="lead">Review new sellers and listings from one focused workspace.</p>
        </div>
        <span className="admin-summary">{(applicationCount ?? 0) + (productCount ?? 0)} items waiting</span>
      </div>
      <nav className="admin-tabs" aria-label="Admin workspace">
        <Link className="is-active" href="/admin" aria-current="page">Overview</Link>
        <Link href="/admin/applications">Lister Applications {applicationCount ? <strong>{applicationCount}</strong> : null}</Link>
        <Link href="/admin/products">Product Listings {productCount ? <strong>{productCount}</strong> : null}</Link>
        <span className="admin-tab-disabled">Refunds <span>Coming soon</span></span>
      </nav>
      <div className="admin-overview-grid">
        <Link className="admin-overview-card admin-overview-card-primary" href="/admin/products">
          <span className="admin-card-kicker">Product listings</span>
          <strong>{productCount ?? 0}</strong>
          <h2>{productCount ? "Listings need your review" : "No listings waiting"}</h2>
          <p>{productCount ? "Open the queue to review the next product." : "New submissions will appear here."}</p>
          <span className="admin-card-link">Open product queue <span aria-hidden="true">→</span></span>
        </Link>
        <Link className="admin-overview-card" href="/admin/applications">
          <span className="admin-card-kicker">Lister applications</span>
          <strong>{applicationCount ?? 0}</strong>
          <h2>{applicationCount ? "Applications need your review" : "No applications waiting"}</h2>
          <p>{applicationCount ? "Approve trusted sellers or request more information." : "You are all caught up for now."}</p>
          <span className="admin-card-link">Open application queue <span aria-hidden="true">→</span></span>
        </Link>
        <div className="admin-overview-card admin-overview-card-muted">
          <span className="admin-card-kicker">Refunds</span>
          <strong>—</strong>
          <h2>Coming soon</h2>
          <p>Refund tools will be added here in a later stage.</p>
        </div>
      </div>
    </section>
  );
}