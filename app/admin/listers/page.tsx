/* eslint-disable @next/next/no-img-element */
import { adminListerDirectory, catalogueCounts } from "@/lib/admin-listers";
import { readAllRows } from "@/lib/read-all-rows";
import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { SUGGESTED_CATEGORY_PREFIX } from "@/lib/application-categories";
import styles from "@/components/lister-onboarding.module.css";

export const dynamic = "force-dynamic";

export default async function AdminListersPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const { supabase } = await requireRole("admin");
  const [applications, shops, products, fulfilment, listerRoles] = await Promise.all([
    readAllRows(offset => supabase.from("lister_applications").select("id, user_id, business_name, contact_name, email, category_type, description, website_or_social, status").eq("status", "approved").order("business_name").order("id").range(offset, offset + 999)),
    readAllRows(offset => supabase.from("lister_storefronts").select("user_id, business_name, description, category_type, website_url, instagram_url, delivery_country, delivery_charge").order("user_id").range(offset, offset + 999)),
    readAllRows(offset => supabase.from("products").select("id, name, image_url, stock_quantity, lister_user_id, review_status, review_reason, is_published, updated_at").order("id").range(offset, offset + 999)),
    readAllRows(offset => supabase.from("seller_orders").select("seller_user_id, fulfilment_status").in("fulfilment_status", ["pending", "packed"]).order("id").range(offset, offset + 999)),
    readAllRows(offset => supabase.from("user_roles").select("user_id").eq("role", "lister").order("user_id").range(offset, offset + 999)),
  ]);
  const shopMap = new Map(shops.data?.map(shop => [shop.user_id, shop]));
  const directory = adminListerDirectory(applications.data ?? [], shops.data ?? [], listerRoles.data ?? []);
  return <section className="admin-review-page">
    <p className="eyebrow">HolyHub admin</p><h1>Listers & shop readiness</h1><p>Shop setup and product visibility for accepted listers. Setup progress is based on saved shop and product information.</p>
    <nav className="admin-tabs" aria-label="Admin workspace"><a href="/admin/orders">Orders</a><Link href="/admin">Overview</Link><Link href="/admin/applications">Lister Applications</Link><Link href="/admin/listers" className="is-active" aria-current="page">Listers</Link><Link href="/admin/products">Product Listings</Link></nav>
    {params.error && <p className="notice notice-error" role="alert">{params.error}</p>}{params.message && <p className="notice notice-success" role="status">{params.message}</p>}
    {applications.error || shops.error || products.error || listerRoles.error ? <p className="notice notice-error" role="alert">Lister information could not be loaded. Please refresh to try again.</p> : <div className="review-list">{directory.map(application => {
      const shop = shopMap.get(application.user_id);
      const listings = products.data?.filter(product => product.lister_user_id === application.user_id) ?? [];
      const { live, pending } = catalogueCounts(listings);
      const returned = listings.filter(product => product.review_status === "rejected").length;
      const drafts = listings.filter(product => product.review_status === "draft").length;
      const outstanding = fulfilment.data?.filter(order => order.seller_user_id === application.user_id).length;
      const category = shop?.category_type ?? application.category_type;
      return <article className="review-card" key={application.id}>
        <div className="review-card-header"><h2>{shop?.business_name ?? application.business_name}</h2><span className="status-pill">{application.hasApplication ? "Approved" : "Lister access"} · {live ? `${live} live` : "No live products"}</span></div>
        <p>{application.contact_name || "Contact name not provided"} · {application.email ? <a href={`mailto:${application.email}`}>{application.email}</a> : "No application contact saved"}</p>
        <p><strong>{!shop ? "Shop setup needed" : !listings.length ? "Shop saved · Add first product" : live ? "Shop has live products" : "Shop saved · No live products"}</strong> · {listings.length} {listings.length === 1 ? "product" : "products"} · {live} live · {pending} awaiting review · {returned} returned for changes · {drafts} drafts</p>
        <p>{fulfilment.error ? "Outstanding order count unavailable" : `${outstanding ?? 0} lister order portions need preparing or dispatch`}</p>
        <Link href={`/admin/orders?lister=${application.user_id}`}>View this lister’s orders →</Link>
        <p className="muted-small">Account ID: {application.user_id}</p><details><summary>View lister information</summary><div className={styles.grid}>
          <section className={styles.tile}><h3 className="admin-section-heading">Application & contact</h3><dl><dt>Business name</dt><dd>{application.business_name}</dd><dt>Contact</dt><dd>{application.contact_name || "Not provided"}</dd><dt>Email</dt><dd>{application.email || "Not provided"}</dd><dt>{application.hasApplication ? "Application status" : "Lister access"}</dt><dd>{application.status}</dd><dt>Website / social</dt><dd>{application.website_or_social || "Not provided"}</dd><dt>About the business</dt><dd>{application.description || "Not provided"}</dd></dl></section>
          <section className={styles.tile}><h3 className="admin-section-heading">Shop & delivery</h3><dl><dt>{category.startsWith(SUGGESTED_CATEGORY_PREFIX) ? "Category suggestion — needs admin review" : "Shop category"}</dt><dd>{category.startsWith(SUGGESTED_CATEGORY_PREFIX) ? category.slice(SUGGESTED_CATEGORY_PREFIX.length) : category}</dd><dt>Shop description</dt><dd>{shop?.description ?? "Shop not set up"}</dd><dt>Website</dt><dd>{shop?.website_url || "Not provided"}</dd><dt>Social</dt><dd>{shop?.instagram_url || "Not provided"}</dd><dt>Dispatch from</dt><dd>{shop?.delivery_country === "GB" ? "United Kingdom" : shop?.delivery_country || "Not set"}</dd><dt>Delivery charge per order</dt><dd>{shop ? `£${Number(shop.delivery_charge).toFixed(2)}` : "Not set"}</dd></dl>{shop && <Link href={`/lister/storefront/${application.user_id}`}>View storefront →</Link>}</section>
        </div><section><h3 className="admin-section-heading">Products</h3>{listings.length ? <ul className="admin-lister-products">{listings.map(product => <li key={product.id}>{product.image_url && <img src={product.image_url} alt="" width={64} height={64} />}<div><Link href={`/admin/products?product=${product.id}`}>{product.name}</Link><p>{product.review_status === "approved" ? product.is_published ? "Approved / live" : "Approved / hidden" : product.review_status === "rejected" ? "Changes needed" : product.review_status === "pending" ? "Pending review" : "Draft"} · Stock: {product.stock_quantity}</p>{product.review_status === "rejected" && <p className="review-reason">{product.review_reason || "No review feedback is saved."}</p>}</div></li>)}</ul> : <p>No products saved.</p>}</section><section><h3 className="admin-section-heading">Orders / fulfilment</h3><p>{fulfilment.error ? "Outstanding order count unavailable" : `${outstanding ?? 0} orders need preparing or dispatch`}</p><Link href={`/admin/orders?lister=${application.user_id}`}>View this lister’s orders and fulfilment →</Link></section>{category.startsWith(SUGGESTED_CATEGORY_PREFIX) && <p className={styles.info}>Suggestion only; no marketplace category has been created. Agree an existing approved category with the lister, who can select it in shop settings and product listings. Direct admin assignment needs a database permission change; creating an official category remains a separate reviewed change.</p>}</details>
      </article>;
    })}{!directory.length && <div className="card empty-state"><h2>No approved listers yet.</h2><Link className="button button-primary" href="/admin/applications">Review applications</Link></div>}</div>}
  </section>;
}
