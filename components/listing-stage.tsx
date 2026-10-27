import Link from "next/link";

export type ListingProgress = { id: string; name?: string; review_status: string; is_published: boolean; review_reason?: string | null };

/** Only render after a complete, successful catalogue read. */
export function ListingStage({ products, publiclyAvailable = false }: { products: ListingProgress[]; publiclyAvailable?: boolean }) {
  const drafts = products.filter(product => product.review_status === "draft");
  const pending = products.filter(product => product.review_status === "pending");
  const returned = products.filter(product => product.review_status === "rejected");
  const prepared = products.filter(product => product.review_status === "approved" && product.is_published);
  const live = publiclyAvailable ? prepared : [];
  const hidden = products.filter(product => product.review_status === "approved" && !product.is_published);
  if (!products.length) return null;
  return <div className="listing-progress" aria-label="Your product progress">
    {returned.length > 0 && <section className="card"><h2>Products need your changes</h2><p>{returned.length} returned for changes. Review the saved feedback, then edit and resubmit.</p><ul>{returned.map(product => <li key={product.id}><strong>{product.name || "Product"}</strong><p>{product.review_reason || "No review feedback is saved. Contact HolyHub before resubmitting if you need guidance."}</p><Link className="button button-quiet" href={`/lister/products/${product.id}/edit`}>Edit product</Link></li>)}</ul></section>}
    {drafts.length > 0 && <section className="card"><h2>{products.length === 1 ? "Your first product is saved as a draft." : "You have products saved as drafts."}</h2><p>{drafts.length} {drafts.length === 1 ? "draft" : "drafts"}. Finish the details, then submit for HolyHub review. Archived products also remain here as drafts.</p><div className="row-actions"><Link className="button button-primary" href={`/lister/products/${drafts[0].id}/edit`}>Finish your product</Link><Link className="button button-quiet" href="/lister/products">View drafts</Link></div></section>}
    {pending.length > 0 && <section className="card"><h2>{pending.length === products.length ? "Your products are awaiting HolyHub review." : "Some products are awaiting HolyHub review."}</h2><p>{pending.length} awaiting review. No resubmission is needed for products awaiting review.</p><Link className="button button-quiet" href="/lister/products">View submitted products</Link></section>}
    {hidden.length > 0 && <section className="card"><h2>{live.length ? "You also have hidden approved products." : "None of your products are currently live."}</h2><p>{hidden.length} approved {hidden.length === 1 ? "product is" : "products are"} hidden. Open a product to review its visibility.</p><Link className="button button-quiet" href={`/lister/products/${hidden[0].id}/edit`}>Review hidden products</Link></section>}
    {!publiclyAvailable && prepared.length > 0 && <section className="card"><h2>{prepared.length} approved {prepared.length === 1 ? "product is" : "products are"} prepared</h2><p>Public availability is blocked until seller activation requirements are confirmed complete.</p><Link href="/lister/onboarding">Check activation requirements →</Link></section>}
    {live.length > 0 && <section className="card"><h2>{live.length} {live.length === 1 ? "product is" : "products are"} live</h2><p>Approved and published in the marketplace.</p><Link className="button button-quiet" href="/lister/products">View your products</Link></section>}
  </div>;
}
