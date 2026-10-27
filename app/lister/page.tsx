import { loadListerActivation } from "@/lib/lister-activation";
import { ListerActivationSummary } from "@/components/lister-activation";
import { ListingStage } from "@/components/listing-stage";
import { HolyHubIcon } from "@/components/holyhub-icon";
import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { getSellerFulfilmentSummary } from "@/lib/fulfilment-summary";
import { readAllRows } from "@/lib/read-all-rows";
import styles from "@/components/lister-onboarding.module.css";
export const dynamic = "force-dynamic";
export default async function ListerDashboardPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireRole("lister");
  const [summary, shopResult, catalogue, sales, activation] = await Promise.all([
    getSellerFulfilmentSummary(supabase, user.id),
    supabase.from("lister_storefronts").select("business_name").eq("user_id", user.id).maybeSingle(),
    readAllRows(offset => supabase.from("products").select("id, name, review_status, is_published, review_reason").eq("lister_user_id", user.id).order("id").range(offset, offset + 999)),
    supabase.from("seller_orders").select("id", { count: "exact", head: true }).eq("seller_user_id", user.id),
    loadListerActivation(supabase, user.id),
  ]);
  const products = catalogue.data ?? [];
  const live = activation.ready ? products.filter(product => product.review_status === "approved" && product.is_published).length : 0;
  const pending = products.filter(product => product.review_status === "pending").length;
  const hour = new Date().getUTCHours();
  return <section className={styles.shell}>
    {(shopResult.error || catalogue.error) && <p role="alert" className="notice notice-error">Some shop setup details could not be loaded. Refresh to check your progress.</p>}
    {params?.error && <p role="alert" className="notice notice-error">{params.error}</p>}
    {params?.message && <p role="status" className="notice notice-success">{params.message}</p>}
    <p className="eyebrow">Your HolyHub shop</p><h1>Good {hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}, {shopResult.data?.business_name || "welcome back"}</h1><p>Make a little room for your next big idea.</p>
    <ListerActivationSummary activation={activation} />
    {!shopResult.error && !shopResult.data && <Link className={styles.banner} href="/lister/onboarding"><strong>Welcome to HolyHub — your lister application has been accepted 💙</strong><p>Continue shop setup →</p></Link>}
    {!shopResult.error && shopResult.data && !catalogue.error && products.length === 0 && <Link className={styles.banner} href="/lister/products/new?onboarding=1"><strong>Your shop is saved. Add your first product.</strong><p>Add photos, details and stock, then submit for HolyHub review →</p></Link>}
    {!catalogue.error && !shopResult.error && shopResult.data && <ListingStage products={products} publiclyAvailable={activation.ready} />}
    <div className={styles.actions}><Link className="button button-primary" href="/lister/products/new">+ Add product</Link><Link className="button button-quiet" href="/lister/orders">Orders to fulfil</Link><Link className="button button-quiet" href="/lister/storefront"><HolyHubIcon name="settings" className="storefront-settings-icon" />Storefront settings</Link><Link className="button button-quiet" href="/lister/legal-details">Seller legal details</Link><Link className="button button-quiet" href="/lister/terms">Lister Terms</Link></div>
    <div className={styles.grid}>
      <Link className={styles.tile} href="/lister/products"><strong>Products</strong><p>{catalogue.error ? "Product counts unavailable. Refresh to try again." : `${live} live · ${pending} awaiting review`}</p></Link>
      <Link className={styles.tile} href="/lister/orders"><strong>Orders to fulfil</strong><p>{summary ? `${summary.toFulfil} need preparing or dispatch` : "Order counts unavailable. Refresh to try again."}</p></Link>
      <Link className={styles.tile} href="/lister/orders"><strong>Sales</strong><p>{sales.error || sales.count == null ? "Sales count unavailable. Refresh to try again." : `${sales.count} orders received`}</p></Link>
      <Link className={styles.tile} href="/lister/storefront"><strong>Shop</strong><p>{shopResult.error ? "Shop details unavailable. Refresh to try again." : shopResult.data?.business_name || "Set up your shop"}</p></Link>
    </div>
    <div className={styles.actions}><Link href="/lister/products/bulk">Bulk upload products</Link><Link href="/account">Your account</Link>{!shopResult.error && shopResult.data && <Link href={`/lister/storefront/${user.id}`}>View shop</Link>}</div>
  </section>;
}
