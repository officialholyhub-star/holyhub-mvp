import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function ListerDashboardPage() {
  await requireRole("lister");

  return (
    <section>
      <p className="eyebrow">HolyHub lister space</p>
      <h2>Manage your marketplace presence</h2>
      <p className="lead">Keep your storefront and product listings up to date.</p>
      <div className="button-row">
        <Link className="button button-primary" href="/lister/products">Manage products</Link>
        <Link className="button button-quiet" href="/lister/storefront">Edit storefront</Link>
        <Link className="button button-quiet" href="/account">Back to account</Link>
      </div>
    </section>
  );
}