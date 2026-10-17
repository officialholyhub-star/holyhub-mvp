/* eslint-disable @next/next/no-img-element */
import { adminListerDirectory, catalogueCounts } from "@/lib/admin-listers";
import { readAllRows } from "@/lib/read-all-rows";
import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { SUGGESTED_CATEGORY_PREFIX } from "@/lib/application-categories";
import { formatRegisteredOffice, formatSellerAddress, formatServiceAddress, sellerEntityLabel, sellerLegalProfileComplete, SELLER_LEGAL_FIELDS, type SellerLegalProfile } from "@/lib/seller-legal";
import { verifySellerLegalProfile } from "./actions";
import styles from "@/components/lister-onboarding.module.css";

export const dynamic = "force-dynamic";

type CurrentTerms = { version: string; content_sha256: string };

export default async function AdminListersPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const { supabase } = await requireRole("admin");
  const [applications, shops, products, fulfilment, listerRoles, legalProfiles, currentTermsResult, termsAcceptances] = await Promise.all([
    readAllRows(offset => supabase.from("lister_applications").select("id, user_id, business_name, contact_name, email, category_type, description, website_or_social, status").eq("status", "approved").order("business_name").order("id").range(offset, offset + 999)),
    readAllRows(offset => supabase.from("lister_storefronts").select("user_id, business_name, description, category_type, website_url, instagram_url, delivery_country, delivery_charge, dispatch_window, dispatch_custom_timeframe").order("user_id").range(offset, offset + 999)),
    readAllRows(offset => supabase.from("products").select("id, name, image_url, stock_quantity, lister_user_id, review_status, review_reason, is_published, updated_at").order("id").range(offset, offset + 999)),
    readAllRows(offset => supabase.from("seller_orders").select("seller_user_id, fulfilment_status").in("fulfilment_status", ["pending", "packed"]).order("id").range(offset, offset + 999)),
    readAllRows(offset => supabase.from("user_roles").select("user_id").eq("role", "lister").order("user_id").range(offset, offset + 999)),
    readAllRows(offset => supabase.from("seller_legal_profiles").select(SELLER_LEGAL_FIELDS).order("user_id").range(offset, offset + 999)),
    supabase.rpc("get_current_lister_terms"),
    readAllRows(offset => supabase.from("lister_terms_acceptances").select("user_id, terms_version, terms_sha256, accepted_at").order("user_id").range(offset, offset + 999)),
  ]);
  const currentTerms = (Array.isArray(currentTermsResult.data) ? currentTermsResult.data[0] : null) as CurrentTerms | null;
  const shopMap = new Map(shops.data?.map(shop => [shop.user_id, shop]));
  const legalMap = new Map((legalProfiles.data as SellerLegalProfile[] | null)?.map(profile => [profile.user_id, profile]) ?? []);
  const acceptedCurrentTerms = new Set((termsAcceptances.data ?? [])
    .filter(row => currentTerms && row.terms_version === currentTerms.version && row.terms_sha256 === currentTerms.content_sha256)
    .map(row => row.user_id));
  const directory = adminListerDirectory(applications.data ?? [], shops.data ?? [], listerRoles.data ?? []);
  const loadError = applications.error || shops.error || products.error || listerRoles.error || legalProfiles.error || currentTermsResult.error || termsAcceptances.error;

  return <section className="admin-review-page">
    <p className="eyebrow">HolyHub admin</p><h1>Listers & shop readiness</h1><p>Shop setup, seller verification, Lister Terms acceptance and product visibility for accepted listers.</p>
    <nav className="admin-tabs" aria-label="Admin workspace"><a href="/admin/orders">Orders</a><Link href="/admin">Overview</Link><Link href="/admin/applications">Lister Applications</Link><Link href="/admin/listers" className="is-active" aria-current="page">Listers</Link><Link href="/admin/products">Product Listings</Link></nav>
    {params.error && <p className="notice notice-error" role="alert">{params.error}</p>}{params.message && <p className="notice notice-success" role="status">{params.message}</p>}
    {!currentTermsResult.error && !currentTerms && <p className="notice notice-info">The final reviewed Lister Terms version has not been activated yet. Customer sales remain fail-closed for every seller.</p>}
    {loadError ? <p className="notice notice-error" role="alert">Lister information could not be loaded. Please refresh to try again.</p> : <div className="review-list">{directory.map(application => {
      const shop = shopMap.get(application.user_id);
      const legal = legalMap.get(application.user_id) ?? null;
      const legalComplete = sellerLegalProfileComplete(legal);
      const serviceAddress = legal ? formatServiceAddress(legal) : "";
      const registeredOffice = legal ? formatRegisteredOffice(legal) : "";
      const termsAccepted = acceptedCurrentTerms.has(application.user_id);
      const dispatchReady = Boolean(shop?.dispatch_window && (shop.dispatch_window !== "made-to-order" || shop.dispatch_custom_timeframe?.trim()));
      const customerReady = legal?.verification_status === "verified" && dispatchReady && termsAccepted;
      const readinessLabel = legal?.verification_status !== "verified" ? "Seller verification needed" : !dispatchReady ? "Dispatch promise needed" : !termsAccepted ? "Lister Terms needed" : "Customer sales ready";
      const listings = products.data?.filter(product => product.lister_user_id === application.user_id) ?? [];
      const catalogue = catalogueCounts(listings);
      const live = customerReady ? catalogue.live : 0;
      const pending = catalogue.pending;
      const returned = listings.filter(product => product.review_status === "rejected").length;
      const drafts = listings.filter(product => product.review_status === "draft").length;
      const outstanding = fulfilment.data?.filter(order => order.seller_user_id === application.user_id).length;
      const category = shop?.category_type ?? application.category_type;
      return <article className="review-card" key={application.id}>
        <div className="review-card-header"><h2>{shop?.business_name ?? application.business_name}</h2><span className="status-pill">{readinessLabel} · {live ? `${live} live` : "No live products"}</span></div>
        <p>{application.contact_name || "Contact name not provided"} · {application.email ? <a href={`mailto:${application.email}`}>{application.email}</a> : "No application contact saved"}</p>
        <p><strong>{!shop ? "Shop setup needed" : !listings.length ? "Shop saved · Add first product" : live ? "Shop has live products" : "Shop saved · No live products"}</strong> · {listings.length} {listings.length === 1 ? "product" : "products"} · {live} live · {pending} awaiting review · {returned} returned for changes · {drafts} drafts</p>
        <p>{fulfilment.error ? "Outstanding order count unavailable" : `${outstanding ?? 0} lister order portions need preparing or dispatch`}</p>
        {legal?.verification_status !== "verified" && <p className="notice notice-info">Customer sales stay unavailable until seller legal details are complete and verified.</p>}
        {legal?.verification_status === "verified" && !dispatchReady && <p className="notice notice-info">Customer sales stay unavailable until a valid dispatch timeframe is saved.</p>}
        {legal?.verification_status === "verified" && dispatchReady && !termsAccepted && <p className="notice notice-info">Customer sales stay unavailable until the active Lister Terms version is accepted.</p>}
        <Link href={`/admin/orders?lister=${application.user_id}`}>View this lister’s orders →</Link>
        <p className="muted-small">Account ID: {application.user_id}</p><details><summary>View lister information</summary><div className={styles.grid}>
          <section className={styles.tile}><h3 className="admin-section-heading">Application & contact</h3><dl><dt>Business name</dt><dd>{application.business_name}</dd><dt>Contact</dt><dd>{application.contact_name || "Not provided"}</dd><dt>Email</dt><dd>{application.email || "Not provided"}</dd><dt>{application.hasApplication ? "Application status" : "Lister access"}</dt><dd>{application.status}</dd><dt>Website / social</dt><dd>{application.website_or_social || "Not provided"}</dd><dt>About the business</dt><dd>{application.description || "Not provided"}</dd></dl></section>
          <section className={styles.tile}><h3 className="admin-section-heading">Seller legal identity</h3><dl><dt>Legal name</dt><dd>{legal?.legal_name ?? "Not submitted"}</dd><dt>Structure</dt><dd>{legal ? sellerEntityLabel(legal.entity_type) : "Not submitted"}</dd><dt>Establishment address</dt><dd>{legal ? formatSellerAddress(legal) : "Not submitted"}</dd><dt>Service address</dt><dd>{serviceAddress || (legal ? "Same as establishment address" : "Not submitted")}</dd><dt>Business email</dt><dd>{legal?.contact_email ?? "Not submitted"}</dd><dt>Business phone</dt><dd>{legal?.contact_phone ?? "Not provided"}</dd><dt>Registration number</dt><dd>{legal?.registration_number ?? "Not provided"}</dd><dt>Registered in</dt><dd>{legal?.registration_jurisdiction ?? "Not provided"}</dd><dt>Registered office</dt><dd>{registeredOffice || "Not provided"}</dd><dt>VAT number</dt><dd>{legal?.vat_number ?? "Not provided"}</dd><dt>Verification</dt><dd>{legal?.verification_status ?? "Not submitted"}</dd></dl>{legal?.verification_note && <p className="review-reason">{legal.verification_note}</p>}{legalComplete && legal?.verification_status !== "verified" && <form action={verifySellerLegalProfile}><input type="hidden" name="seller_user_id" value={application.user_id} /><button className="button button-primary" type="submit">Verify seller details</button></form>}</section>
          <section className={styles.tile}><h3 className="admin-section-heading">Shop & activation</h3><dl><dt>{category.startsWith(SUGGESTED_CATEGORY_PREFIX) ? "Category suggestion — needs admin review" : "Shop category"}</dt><dd>{category.startsWith(SUGGESTED_CATEGORY_PREFIX) ? category.slice(SUGGESTED_CATEGORY_PREFIX.length) : category}</dd><dt>Shop description</dt><dd>{shop?.description ?? "Shop not set up"}</dd><dt>Website</dt><dd>{shop?.website_url || "Not provided"}</dd><dt>Social</dt><dd>{shop?.instagram_url || "Not provided"}</dd><dt>Dispatch from</dt><dd>{shop?.delivery_country === "GB" ? "United Kingdom" : shop?.delivery_country || "Not set"}</dd><dt>Delivery charge per order</dt><dd>{shop ? `£${Number(shop.delivery_charge).toFixed(2)}` : "Not set"}</dd><dt>Dispatch timeframe</dt><dd>{shop?.dispatch_window ? shop.dispatch_window === "made-to-order" ? `Made to order — ${shop.dispatch_custom_timeframe || "timeframe missing"}` : shop.dispatch_window : "Not set"}</dd><dt>Current Lister Terms</dt><dd>{currentTerms ? termsAccepted ? `Accepted · ${currentTerms.version}` : `Not accepted · ${currentTerms.version}` : "Final version not active"}</dd></dl>{shop && <Link href={`/lister/storefront/${application.user_id}`}>View storefront →</Link>}</section>
        </div><section><h3 className="admin-section-heading">Products</h3>{listings.length ? <ul className="admin-lister-products">{listings.map(product => <li key={product.id}>{product.image_url && <img src={product.image_url} alt="" width={64} height={64} />}<div><Link href={`/admin/products?product=${product.id}`}>{product.name}</Link><p>{product.review_status === "approved" ? product.is_published ? customerReady ? "Approved / live" : `Approved / hidden until ${readinessLabel.toLowerCase()}` : "Approved / hidden" : product.review_status === "rejected" ? "Changes needed" : product.review_status === "pending" ? "Pending review" : "Draft"} · Stock: {product.stock_quantity}</p>{product.review_status === "rejected" && <p className="review-reason">{product.review_reason || "No review feedback is saved."}</p>}</div></li>)}</ul> : <p>No products saved.</p>}</section><section><h3 className="admin-section-heading">Orders / fulfilment</h3><p>{fulfilment.error ? "Outstanding order count unavailable" : `${outstanding ?? 0} orders need preparing or dispatch`}</p><Link href={`/admin/orders?lister=${application.user_id}`}>View this lister’s orders and fulfilment →</Link></section>{category.startsWith(SUGGESTED_CATEGORY_PREFIX) && <p className={styles.info}>Suggestion only; no marketplace category has been created. Agree an existing approved category with the lister, who can select it in shop settings and product listings.</p>}</details>
      </article>;
    })}{!directory.length && <div className="card empty-state"><h2>No approved listers yet.</h2><Link className="button button-primary" href="/admin/applications">Review applications</Link></div>}</div>}
  </section>;
}
