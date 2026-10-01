"use client";

/* Review images are user-provided URLs and are displayed at their source aspect ratio. */
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { reviewProductListing } from "@/app/admin/actions";
import { orderedProductImages, type ProductImage } from "@/lib/product-images";
import galleryStyles from "./admin-product-review-card.module.css";
import { REJECTION_PRESETS } from "@/lib/product-review";

type ProductReviewSnapshot = {
  previous_name: string;
  previous_description: string;
  previous_category_type: string;
  previous_image_url: string | null;
  previous_size_guide_url: string | null;
  previous_gallery_images?: string[] | null;
};

type ProductReview = {
  id: string;
  name: string;
  description: string;
  category_type: string;
  price: number | string;
  image_url: string | null;
  size_guide_url: string | null;
  created_at: string;
  product_images?: ProductImage[];
  review_snapshot?: ProductReviewSnapshot | null;
};

function ChangeRow({ label, previous, current }: { label: string; previous: string; current: string }) {
  return (
    <div className="review-change-row">
      <strong>{label}</strong>
      <span><em>Previous:</em> {previous || "None"}</span>
      <span><em>New:</em> {current || "None"}</span>
    </div>
  );
}

export function AdminProductReviewCard({ product, storefrontName }: { product: ProductReview; storefrontName: string }) {
  const imageDialogRef = useRef<HTMLDialogElement>(null);
  const snapshot = product.review_snapshot;
  const images = orderedProductImages(product.product_images, product.image_url);
  const previousImages = snapshot?.previous_gallery_images ?? (snapshot?.previous_image_url ? [snapshot.previous_image_url] : []);
  const [zoomUrl, setZoomUrl] = useState(product.image_url);
  function imagePreviews(urls: string[], label: string) {
    return <div className={galleryStyles.images} aria-label={label}>{urls.map((url, index) => <button type="button" key={url} aria-label={`${label} image ${index + 1}`} onClick={() => { setZoomUrl(url); imageDialogRef.current?.showModal(); }}><img src={url} alt={`${label} image ${index + 1}`} /></button>)}</div>;
  }
  const changes = snapshot ? [
    snapshot.previous_name !== product.name && <ChangeRow key="name" label="Product name" previous={snapshot.previous_name} current={product.name} />,
    snapshot.previous_description !== product.description && <ChangeRow key="description" label="Description" previous={snapshot.previous_description} current={product.description} />,
    snapshot.previous_category_type !== product.category_type && <ChangeRow key="category" label="Category" previous={snapshot.previous_category_type} current={product.category_type} />,
    snapshot.previous_image_url !== product.image_url && <p className="review-change-row" key="image"><strong>Product image</strong><span>Previous → New</span></p>,
    JSON.stringify(previousImages) !== JSON.stringify(images) && <div className="review-change-row" key="gallery"><strong>Product gallery (ordered)</strong><span>Previous</span>{imagePreviews(previousImages, "Previous gallery")}<span>New</span>{imagePreviews(images, "Submitted gallery")}</div>,
    snapshot.previous_size_guide_url !== product.size_guide_url && <p className="review-change-row" key="size-guide"><strong>Size guide</strong><span>Previous → New</span></p>,
  ].filter(Boolean) : [];

  return (
    <article className="review-card product-review-card">
      <div className="product-review-layout">
        {product.image_url ? (
          <>
            <button className="admin-review-image-button" type="button" onClick={() => { setZoomUrl(product.image_url); imageDialogRef.current?.showModal(); }} aria-label={`Enlarge ${product.name} image`}>
              <img className="product-review-image" src={product.image_url} alt={product.name} />
            </button>
            <dialog ref={imageDialogRef} className="admin-image-dialog" aria-label={`${product.name} image preview`} onCancel={(event) => { event.preventDefault(); imageDialogRef.current?.close(); }}>
              <div className="admin-image-dialog-content">
                <button className="button button-quiet admin-image-close" type="button" onClick={() => imageDialogRef.current?.close()}>Close</button>
                {zoomUrl && <img src={zoomUrl} alt={product.name} />}
              </div>
            </dialog>
          </>
        ) : <div className="product-review-image product-placeholder" aria-label="No product image">No image</div>}
        <div className="product-review-content">
          <div className="review-card-header">
            <div>
              <p className="eyebrow">{storefrontName} · {product.category_type}</p>
              <h2>{product.name}</h2>
              <p className="muted-small">Submitted {new Date(product.created_at).toLocaleDateString("en-GB")} · £{Number(product.price).toFixed(2)}</p>
            </div>
            <span className="status-pill status-pending">pending</span>
          </div>
          {images.length > 1 && imagePreviews(images, "Current gallery")}
          <p className="review-description">{product.description}</p>
          {changes.length > 0 && (
            <section className="changes-submitted" aria-labelledby={`changes-${product.id}`}>
              <h3 id={`changes-${product.id}`}>Changes submitted</h3>
              {changes}
            </section>
          )}
          <div className="review-actions">
            <form action={reviewProductListing} className="review-reject-form">
              <input type="hidden" name="product_id" value={product.id} />
              <input type="hidden" name="decision" value="reject" />
              <fieldset className="rejection-presets">
                <legend>Why does this need changes?</legend>
                {REJECTION_PRESETS.map((preset) => (
                  <label key={preset}><input type="checkbox" name="rejection_preset" value={preset} /> <span>{preset}</span></label>
                ))}
              </fieldset>
              <label className="field"><span>Optional note</span><textarea name="review_note" maxLength={1000} rows={3} placeholder="Add context for the lister (optional)" /></label>
              <button className="button button-secondary" type="submit">Reject / request changes</button>
            </form>
            <form action={reviewProductListing}>
              <input type="hidden" name="product_id" value={product.id} />
              <input type="hidden" name="decision" value="approve" />
              <button className="button button-primary" type="submit">Approve listing</button>
            </form>
          </div>
        </div>
      </div>
    </article>
  );
}
