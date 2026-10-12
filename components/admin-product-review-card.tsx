"use client";
import { LISTING_STATUS_LABELS } from "@/lib/help-copy";
import { DraftForm } from "@/components/draft-form";

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
  updated_at?: string;
  review_status?: string;
  review_reason?: string | null;
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

export function AdminProductReviewCard({ product, storefrontName, readOnly = false, draftOwner = "admin" }: { product: ProductReview; storefrontName: string; readOnly?: boolean; draftOwner?: string }) {
  const imageDialogRef = useRef<HTMLDialogElement>(null);
  const snapshot = product.review_snapshot;
  const images = orderedProductImages(product.product_images, product.image_url);
  const previousImages = snapshot?.previous_gallery_images ?? (snapshot?.previous_image_url ? [snapshot.previous_image_url] : []);
  const [preview, setPreview] = useState({ urls: images, index: 0 });
  const [activeImage, setActiveImage] = useState(0);
  const touchStart = useRef<number | null>(null);
  function movePreview(delta: number) {
    setPreview(current => ({ ...current, index: (current.index + delta + current.urls.length) % current.urls.length }));
  }
  function openPreview(urls: string[], index: number) {
    setPreview({ urls, index });
    imageDialogRef.current?.showModal();
  }
  function swipe(end: number, move: (delta: number) => void) {
    if (touchStart.current !== null && Math.abs(end - touchStart.current) > 40) move(end < touchStart.current ? 1 : -1);
    touchStart.current = null;
  }
  function imagePreviews(urls: string[], label: string) {
    return <div className={galleryStyles.images} aria-label={label}>{urls.map((url, index) => <button type="button" key={url} aria-label={`${label} image ${index + 1}`} onClick={() => { setPreview({ urls, index }); imageDialogRef.current?.showModal(); }}><img src={url} alt={`${label} image ${index + 1}`} /></button>)}</div>;
  }
  const changes = snapshot ? [
    snapshot.previous_name !== product.name && <ChangeRow key="name" label="Product name" previous={snapshot.previous_name} current={product.name} />,
    snapshot.previous_description !== product.description && <ChangeRow key="description" label="Description" previous={snapshot.previous_description} current={product.description} />,
    snapshot.previous_category_type !== product.category_type && <ChangeRow key="category" label="Category" previous={snapshot.previous_category_type} current={product.category_type} />,
    snapshot.previous_image_url !== product.image_url && <p className="review-change-row" key="image"><strong>Product image</strong><span>Previous → New</span></p>,
    JSON.stringify(previousImages) !== JSON.stringify(images) && <div className="review-change-row" key="gallery"><strong>Product images (in display order)</strong><span>Previous</span>{imagePreviews(previousImages, "Previous gallery")}<span>New</span>{imagePreviews(images, "Submitted gallery")}</div>,
    snapshot.previous_size_guide_url !== product.size_guide_url && <p className="review-change-row" key="size-guide"><strong>Size guide</strong><span>Previous → New</span></p>,
  ].filter(Boolean) : [];

  return (
    <article className="review-card product-review-card">
      <div className="product-review-layout">
        {images.length > 0 ? (
          <div>
            <button className="admin-review-image-button" type="button" onClick={() => openPreview(images, activeImage)} onTouchStart={event => { touchStart.current = event.touches[0].clientX; }} onTouchEnd={event => swipe(event.changedTouches[0].clientX, delta => setActiveImage(index => (index + delta + images.length) % images.length))} aria-label={`Enlarge ${product.name} image`}>
              <img className="product-review-image" src={images[activeImage]} alt={product.name} />
            </button>
            {images.length > 1 && <div className={galleryStyles.navigation} aria-label="Product image navigation">
              <button type="button" className="button button-quiet" aria-label="Previous product image" onClick={() => setActiveImage(index => (index - 1 + images.length) % images.length)}>←</button>
              <span aria-live="polite">{activeImage + 1} / {images.length}</span>
              <button type="button" className="button button-quiet" aria-label="Next product image" onClick={() => setActiveImage(index => (index + 1) % images.length)}>→</button>
            </div>}
            <dialog ref={imageDialogRef} className="admin-image-dialog" aria-label={`${product.name} image preview`} onCancel={(event) => { event.preventDefault(); imageDialogRef.current?.close(); }}>
              <div className="admin-image-dialog-content" onTouchStart={event => { touchStart.current = event.touches[0].clientX; }} onTouchEnd={event => swipe(event.changedTouches[0].clientX, movePreview)} onKeyDown={event => { if (event.key === "ArrowLeft") movePreview(-1); if (event.key === "ArrowRight") movePreview(1); }}>
                <button className="button button-quiet admin-image-close" type="button" onClick={() => imageDialogRef.current?.close()}>Close</button>
                {preview.urls[preview.index] && <img src={preview.urls[preview.index]} alt={`${product.name} image ${preview.index + 1}`} />}
                {preview.urls.length > 1 && <div className={galleryStyles.navigation}>
                  <button type="button" className="button button-quiet" aria-label="Previous preview image" onClick={() => movePreview(-1)}>←</button>
                  <span aria-live="polite">{preview.index + 1} / {preview.urls.length}</span>
                  <button type="button" className="button button-quiet" aria-label="Next preview image" onClick={() => movePreview(1)}>→</button>
                </div>}
              </div>
            </dialog>
          </div>
        ) : <div className="product-review-image product-placeholder" aria-label="No product image">No image</div>}
        <div className="product-review-content">
          <div className="review-card-header">
            <div>
              <p className="eyebrow">{storefrontName} · {product.category_type}</p>
              <h2>{product.name}</h2>
              <p className="muted-small">Submitted {new Date(product.created_at).toLocaleDateString("en-GB")} · £{Number(product.price).toFixed(2)}</p>
            </div>
            <span className="status-pill">{readOnly ? LISTING_STATUS_LABELS[product.review_status as keyof typeof LISTING_STATUS_LABELS] ?? "Status unavailable" : "Awaiting your review"}</span>
          </div>
          {product.review_status === "rejected" && <p className="review-reason"><strong>Review feedback:</strong> {product.review_reason || "No review feedback is saved."}</p>}
          {images.length > 1 && imagePreviews(images, "Current gallery")}
          <p className="review-description">{product.description}</p>
          {changes.length > 0 && (
            <section className="changes-submitted" aria-labelledby={`changes-${product.id}`}>
              <h3 id={`changes-${product.id}`}>Changes submitted</h3>
              {changes}
            </section>
          )}
          <div className={galleryStyles.reviewActions}>
            {!readOnly && <DraftForm draftKey={`hh-review-product-${draftOwner}-${product.id}`} action={reviewProductListing} className="review-reject-form">
              <input type="hidden" name="product_id" value={product.id} /><input type="hidden" name="product_version" value={product.updated_at ?? ""} />
              <input type="hidden" name="decision" value="reject" />
              <fieldset className={galleryStyles.reasons}>
                <legend>Why does this need changes?</legend>
                {REJECTION_PRESETS.map((preset) => (
                  <label className={galleryStyles.reason} key={preset}><input type="checkbox" name="rejection_preset" value={preset} /> <span>{preset}</span></label>
                ))}
              </fieldset>
              <label className="field"><span>Note for the lister (optional)</span><textarea name="review_note" maxLength={1000} rows={3} placeholder="Add context for the lister (optional)" /></label>
              <button className="button button-secondary" type="submit">Request changes</button>
            </DraftForm>}
            {!readOnly && <form action={reviewProductListing}>
              <input type="hidden" name="product_id" value={product.id} /><input type="hidden" name="product_version" value={product.updated_at ?? ""} />
              <input type="hidden" name="decision" value="approve" />
              <button className="button button-primary" type="submit">Approve listing</button>
            </form>}
          </div>
        </div>
      </div>
    </article>
  );
}
