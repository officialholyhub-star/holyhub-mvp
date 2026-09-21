import Link from "next/link";
import Image from "next/image";
import { requireRole } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function ListerDashboardPage() {
  const { supabase, user } = await requireRole("lister");
  const { count: productCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("lister_user_id", user.id);

  return (
    <section className="lister-space">
      <div className="lister-heading">
        <p className="eyebrow">Your seller space</p>
        <h1>Build your brand on HolyHub.</h1>
        <p className="lead">Everything you need to keep your shop ready.</p>
      </div>
      <div className="lister-image-wrap">
        <Image src="/images/creator-studio.jpg" alt="A creator meeting a customer in a bright studio" width={1200} height={800} priority />
      </div>
      <div className="lister-actions">
        <Link className="lister-action-card lister-action-primary" href="/lister/products">
          <span className="lister-action-index">01</span>
          <span><strong>Products</strong><small>Add and manage your listings</small></span>
          <span className="lister-action-arrow" aria-hidden="true">→</span>
        </Link>
        <Link className="lister-action-card" href="/lister/storefront">
          <span className="lister-action-index">02</span>
          <span><strong>Storefront</strong><small>Shape how your brand appears</small></span>
          <span className="lister-action-arrow" aria-hidden="true">→</span>
        </Link>
        <Link className="lister-action-card" href="/account">
          <span className="lister-action-index">03</span>
          <span><strong>Account</strong><small>Manage your personal details</small></span>
          <span className="lister-action-arrow" aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="lister-summary"><strong>{productCount ?? 0}</strong><span>product listings</span></div>
    </section>
  );
}